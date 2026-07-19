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

export function findNextIntersection(
	f: (x: number) => number,
	target: number,
	startX: number = 0,
	endX: number = 1,
	tolerance: number = 1e-6,
	maxIterations: number = 100,
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
			// 符号变化，进行二分查找
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

	// 将区间分成多个小区间
	const samples = 1000;
	let prevX = a;
	let prevVal = f(prevX);

	for (let i = 1; i <= samples; i++) {
		const x = a + ((b - a) * i) / samples;
		const val = f(x);

		// 检查是否接近目标值
		if (Math.abs(val - v) < tolerance) {
			return x;
		}

		// 检查是否有符号变化
		if ((prevVal - v) * (val - v) < 0) {
			// 在区间 [prevX, x] 内进行二分查找
			let lo = prevX;
			let hi = x;
			for (let iter = 0; iter < maxIterations; iter++) {
				const mid = (lo + hi) / 2;
				const midVal = f(mid);
				if (Math.abs(midVal - v) < tolerance) {
					return mid;
				}
				if ((prevVal - v) * (midVal - v) < 0) {
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
		this.callback(progress);
		this.time.reqNextFrame(() => this.r());
	}
	stopTimeline() {
		this.stop = true;
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

export class AnimationGear {
	time: Time;
	currentState: string;
	private stateTransitions: {
		stateName: string;
		nextStates: string;
		cb: (num: number) => void;
		op: {
			forward: {
				map?: (num: number) => number;
				duration: number;
			};
			backward: {
				map?: (num: number) => number;
				duration: number;
			};
		};
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

	setTransition(
		stateName: string,
		nextStates: string,
		cb: (num: number) => void,
		op: {
			forward: {
				map?: (num: number) => number;
				duration: number;
			};
			backward: {
				map?: (num: number) => number;
				duration: number;
			};
		},
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
					const m = (num: number) => {
						const mappedNum = transition.op.forward.map
							? transition.op.forward.map(num)
							: num;
						return mappedNum;
					};
					return {
						duration: transition.op.forward.duration,
						f: (num) => transition.cb(m(num)),
						m,
					};
				} else {
					// backward
					const m = (num: number) => {
						const mappedNum = transition.op.backward.map
							? transition.op.backward.map(num)
							: num;
						return 1 - mappedNum;
					};
					return {
						duration: transition.op.backward.duration,
						f: (num) => transition.cb(m(num)),
						m,
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
				const v = firstT.m(p);
				const t = this.getTransition(oldState, newState);
				if (!t) return;
				const newF = t.m;
				const x = findInverse(newF, v);
				if (x === null) return;
				first.timeLine.stopTimeline();
				const newTimeLine = new TimeLine(this.time, t.duration, (n) => {
					t.f(n);
					if (n === 1) {
						this.bigTimeLine.shift();
						this.bigTimeLine.at(0)?.timeLine.start();
					}
				});
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
				const thisT = new TimeLine(this.time, t.duration, (n) => {
					t.f(n);
					if (n === 1) {
						this.bigTimeLine.shift();
						this.bigTimeLine.at(0)?.timeLine.start();
					}
				});
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
				const t = new TimeLine(this.time, f.duration, (n) => {
					f.f(n);
					if (n === 1) {
						this.bigTimeLine.shift();
						this.bigTimeLine.at(0)?.timeLine.start();
					}
				});
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
