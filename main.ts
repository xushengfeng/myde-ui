/** 用于方便模拟时间 */
export type TimeerHandler = number & { __: "TimeerHandler" };
export interface Time {
	getTimeMs(): number;
	setTimeOut: (ms: number, callback: () => void) => TimeerHandler;
	clearTimeOut: (handler: TimeerHandler) => void;
	reqNextFrame: (callback: () => void) => void;
}

export function getFunctionRange(
	f: (x: number) => number,
	a: number = 0,
	b: number = 1,
	samples: number = 1000,
): { min: number; max: number } {
	let min = Infinity;
	let max = -Infinity;
	for (let i = 0; i <= samples; i++) {
		const x = a + ((b - a) * i) / samples;
		const val = f(x);
		if (val < min) min = val;
		if (val > max) max = val;
	}
	return { min, max };
}

function _findRootByBisection(
	f: (x: number) => number,
	target: number,
	startX: number,
	endX: number,
	tolerance: number,
	maxIterations: number,
): number | null {
	const samples = 1000;
	let prevX = startX;
	let prevVal = f(prevX);
	for (let i = 1; i <= samples; i++) {
		const x = startX + ((endX - startX) * i) / samples;
		const val = f(x);
		if (Math.abs(val - target) < tolerance) {
			return x;
		}
		if ((prevVal - target) * (val - target) < 0) {
			let lo = prevX;
			let hi = x;
			for (let iter = 0; iter < maxIterations; iter++) {
				const mid = (lo + hi) / 2;
				const midVal = f(mid);
				if (Math.abs(midVal - target) < tolerance) {
					return mid;
				}
				if ((prevVal - target) * (midVal - target) < 0) {
					hi = mid;
				} else {
					lo = mid;
				}
			}
			return (lo + hi) / 2;
		}
		prevX = x;
		prevVal = val;
	}
	return null;
}

export function findNextIntersection(
	f: (x: number) => number,
	target: number,
	startX: number = 0,
	endX: number = 1,
	tolerance: number = 1e-6,
	maxIterations: number = 100,
): number | null {
	return _findRootByBisection(f, target, startX, endX, tolerance, maxIterations);
}

export function findInverse(
	f: (x: number) => number,
	v: number,
	a: number = 0,
	b: number = 1,
	tolerance: number = 1e-6,
	maxIterations: number = 100,
): number | null {
	// 先检查是否有解
	const range = getFunctionRange(f, a, b, 1000);
	if (v < range.min || v > range.max) {
		return null;
	}

	// 尝试使用通用二分查找
	const result = _findRootByBisection(f, v, a, b, tolerance, maxIterations);
	if (result !== null) {
		return result;
	}

	// 如果没有找到精确解，检查端点
	if (Math.abs(f(a) - v) < tolerance) {
		return a;
	}
	if (Math.abs(f(b) - v) < tolerance) {
		return b;
	}

	return null;
}

class defaultTime implements Time {
	getTimeMs(): number {
		return Date.now();
	}
	setTimeOut(ms: number, callback: () => void): TimeerHandler {
		const handler = setTimeout(callback, ms);
		return handler as TimeerHandler;
	}

	clearTimeOut(handler: TimeerHandler): void {
		clearTimeout(handler as number);
	}

	reqNextFrame(callback: () => void): void {
		requestAnimationFrame(callback);
	}
}

class TimeLine {
	constructor(
		private time: Time,
		private duration: number,
		private callback: (num: number) => void,
	) {}
	private stop = true;
	private startTime: number = 0;
	private endTime: number = 0;
	private stopProgress: number = 1.1;
	initTime() {
		this.startTime = this.time.getTimeMs();
		this.endTime = this.startTime + this.duration;
	}
	launch() {
		if (!this.stop) {
			return;
		}
		this.stop = false;
		this.r();
	}
	start() {
		this.initTime();
		if (!this.stop) {
			return;
		}
		this.stop = false;
		this.callback(0);
		this.r();
	}
	private r() {
		if (this.stop) {
			return;
		}
		const currentTime = this.time.getTimeMs();
		if (currentTime >= this.endTime) {
			this.callback(1);
			this.stop = true;
			return;
		}
		const progress = (currentTime - this.startTime) / this.duration;
		if (progress >= this.stopProgress) {
			this.callback(this.stopProgress);
			this.stop = true;
			return;
		}
		this.callback(progress);
		this.time.reqNextFrame(() => this.r());
	}
	stopTimeline() {
		this.stop = true;
	}
	stopTimelineAt(progress: number) {
		this.stopProgress = progress;
	}
	isRunning() {
		return !this.stop;
	}
	getProgress() {
		if (this.stop) {
			return 0;
		}
		const currentTime = this.time.getTimeMs();
		if (currentTime >= this.endTime) {
			return 1;
		}
		const progress = (currentTime - this.startTime) / this.duration;
		return progress;
	}
	setProgress(progress: number) {
		const currentTime = this.time.getTimeMs();
		this.startTime = currentTime - progress * this.duration;
		this.endTime = currentTime + (1 - progress) * this.duration;
	}
	getRestDuration() {
		return this.endTime - this.time.getTimeMs();
	}
	setRestDuration(duration: number) {
		if (this.stop) {
			return;
		}
		const currentTime = this.time.getTimeMs();
		this.endTime = currentTime + duration;
		this.startTime = this.endTime - this.duration;
	}
}

type TransitionOp = {
	forward: {
		map: (num: number) => number;
		duration: number;
	};
	// 如果相关为空，继承forward
	backward?: {
		map?: (num: number) => number;
		duration?: number;
	};
};

export class AnimationGear {
	time: Time;
	currentState: string;
	private stateTransitions: {
		stateName: string;
		nextStates: string;
		cb: (num: number) => void;
		op: TransitionOp;
		timeLine?: TimeLine;
	}[] = [];
	private bigTimeLine: {
		fromState: string;
		toState: string;
		timeLine: TimeLine;
		durationHint?: number;
		startTime: number;
	}[] = [];
	constructor(
		private state: Record<
			string,
			{
				name: string;
				/** 实际是双向图，但是在描述中只能描述一条边 */
				next: string[];
			}
		>,
		op?: {
			time?: Time;
		},
	) {
		this.time = op?.time ?? new defaultTime();
		this.currentState = Object.keys(this.state)[0];
	}

	private createTimeLine(
		duration: number,
		cb: (num: number) => void,
	): TimeLine {
		return new TimeLine(this.time, duration, (n) => {
			cb(n);
			if (n === 1) {
				this.bigTimeLine.shift();
				this.bigTimeLine.at(0)?.timeLine.start();
			}
		});
	}

	setTransition(
		stateName: string,
		nextStates: string,
		cb: (num: number) => void,
		op: TransitionOp,
	) {
		this.stateTransitions.push({
			stateName,
			nextStates,
			cb,
			op,
		});
	}
	private getTransition(
		oldState: string,
		newState: string,
	):
		| {
				m: (num: number) => number;
				f: (num: number) => void;
				duration: number;
				sameMap: boolean;
		  }
		| undefined {
		for (const transition of this.stateTransitions) {
			if (
				(transition.stateName === oldState &&
					transition.nextStates === newState) ||
				(transition.stateName === newState &&
					transition.nextStates === oldState)
			) {
				if (transition.stateName === oldState) {
					// forward
					const m = (num: number) => transition.op.forward.map(num);
					return {
						duration: transition.op.forward.duration,
						f: (num) => transition.cb(m(num)),
						m,
						sameMap: transition.op.backward?.map === undefined,
					};
				} else {
					// backward
					const m = (num: number) => {
						const mappedNum = transition.op.backward?.map
							? transition.op.backward.map(num)
							: transition.op.forward.map(num);
						return 1 - mappedNum;
					};
					return {
						duration:
							transition.op.backward?.duration ??
							transition.op.forward.duration,
						f: (num) => transition.cb(m(num)),
						m,
						sameMap: transition.op.backward?.map === undefined,
					};
				}
			}
		}
	}

	moveToState(stateName: string) {
		if (!this.state[stateName]) {
			throw new Error(`State ${stateName} does not exist.`);
		}
		const oldState = this.currentState;
		const newState = stateName;
		this.currentState = newState;

		if (this.bigTimeLine.length > 0) {
			const first = this.bigTimeLine[0];
			if (first.fromState === newState && first.toState === oldState) {
				// 反解
				const p = first.timeLine.getProgress();
				const firstT = this.getTransition(first.fromState, first.toState);
				if (!firstT) return;
				const t = this.getTransition(oldState, newState);
				if (!t) return;
				let x: number | null = null;
				if (firstT.sameMap) {
					// 直接反解
					x = 1 - p;
				} else {
					const v = firstT.m(p);
					const newF = t.m;
					x = findInverse(newF, v);
				}
				// 特殊值域匹配
				if (x !== null) {
					first.timeLine.stopTimeline();
					const newTimeLine = this.createTimeLine(t.duration, t.f);
					this.bigTimeLine[0] = {
						fromState: oldState,
						toState: newState,
						timeLine: newTimeLine,
						startTime: this.time.getTimeMs(),
					};
					newTimeLine.initTime();
					newTimeLine.setProgress(x);
					newTimeLine.launch();
				} else {
					const range = getFunctionRange(t.m, 0, 1);
					const v = firstT.m(p);
					if (range.min <= v && v <= range.max) {
						console.warn("理应可以反解，但是反解失败");
						this.bigTimeLine.push({
							fromState: oldState,
							toState: newState,
							timeLine: this.createTimeLine(t.duration, t.f),
							startTime: this.time.getTimeMs(),
						});
					} else {
						const target = v < range.min ? range.min : range.max;
						const x = findInverse(t.m, target);
						if (x === null) {
							console.warn("找不到切入点");
							this.bigTimeLine.push({
								fromState: oldState,
								toState: newState,
								timeLine: this.createTimeLine(t.duration, t.f),
								startTime: this.time.getTimeMs(),
							});
						} else {
							// 等当前运行到重合点
							first.timeLine.stopTimelineAt(x);
							this.bigTimeLine.push({
								fromState: oldState,
								toState: newState,
								timeLine: this.createTimeLine(t.duration, t.f),
								startTime: this.time.getTimeMs(),
							});
						}
					}
				}
			} else {
				if (this.bigTimeLine.at(-1)?.toState !== oldState) {
					console.warn(
						`当前状态${oldState}与最后一个时间线的目标状态${this.bigTimeLine.at(-1)?.toState}不匹配，已忽略`,
					);
					return;
				}
				// 加速
				const p = first.timeLine.getProgress();
				const restDuration = first.timeLine.getRestDuration();
				first.timeLine.setRestDuration(restDuration * p);
				for (let i = 1; i < this.bigTimeLine.length; i++) {
					const t = this.bigTimeLine[i];
					if (t.durationHint) t.timeLine.setRestDuration(t.durationHint);
				}
				const t = this.getTransition(oldState, newState);
				if (!t) return;
				// 最后一个时间线应该保持正常过渡优雅结尾
				// 除非不是最后一个，那就按改变状态间隔来计
				const thisT = this.createTimeLine(t.duration, t.f);
				const now = this.time.getTimeMs();
				const lastT = this.bigTimeLine.at(-1);
				if (!lastT) return;
				this.bigTimeLine.push({
					fromState: oldState,
					toState: newState,
					timeLine: thisT,
					durationHint: now - lastT.startTime,
					startTime: now,
				});
			}
		} else {
			const f = this.getTransition(oldState, newState);
			if (f) {
				const t = this.createTimeLine(f.duration, f.f);
				this.bigTimeLine.push({
					fromState: oldState,
					toState: newState,
					timeLine: t,
					startTime: this.time.getTimeMs(),
				});
				t.start();
			}
		}
	}
}
