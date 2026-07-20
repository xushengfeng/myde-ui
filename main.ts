export type TimeerHandler = number & { __: "TimeerHandler" };
export interface Time {
	getTimeMs(): number;
	setTimeOut: (ms: number, callback: () => void) => TimeerHandler;
	clearTimeOut: (handler: TimeerHandler) => void;
	reqNextFrame: (callback: () => void) => void;
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

export type TransitionConfig = {
	duration: number;
	map?: (num: number) => number;
};

export class AnimationGear<
	T extends Record<string, number> = Record<string, number>,
> {
	time: Time;

	private states: Map<
		string,
		{
			value: T;
			next: string[];
		}
	> = new Map();

	currentStateName: string | null;
	private currentValue: T;
	private defaultTransition: TransitionConfig;
	private updateCallback: ((value: T) => void) | null = null;

	private currentTimeline: {
		fromValue: T;
		toValue: T;
		timeLine: TimeLine;
		fromStateName?: string;
		toStateName?: string;
	} | null = null;

	constructor(initial: T, op?: { time?: Time; transition?: TransitionConfig }) {
		this.time = op?.time ?? new defaultTime();
		this.currentValue = { ...initial } as T;
		this.currentStateName = null;
		this.defaultTransition = op?.transition ?? { duration: 300, map: (x) => x };
	}

	addState(name: string, value: T, next: string[]) {
		this.states.set(name, { value: { ...value } as T, next });
		return this;
	}

	setUpdateCallback(cb: (value: T) => void) {
		this.updateCallback = cb;
		return this;
	}

	private interpolate(from: T, to: T, progress: number): T {
		const result = {} as T;
		for (const key in from) {
			if (key in to) {
				(result[key] as number) = from[key] + (to[key] - from[key]) * progress;
			} else {
				result[key] = from[key];
			}
		}
		return result;
	}

	private getCurrentVisualValue(): T {
		if (!this.currentTimeline) {
			return { ...this.currentValue } as T;
		}

		const progress = this.currentTimeline.timeLine.getProgress();
		return this.interpolate(
			this.currentTimeline.fromValue,
			this.currentTimeline.toValue,
			progress,
		);
	}

	private createTimeLine(
		duration: number,
		cb: (num: number) => void,
	): TimeLine {
		return new TimeLine(this.time, duration, (n) => {
			cb(n);
			if (n === 1) {
				this.currentTimeline = null;
			}
		});
	}

	moveTo(target: string | Partial<T>, transition?: number | TransitionConfig) {
		const oldValue = this.getCurrentVisualValue();
		let newValue: T;
		let targetStateName: string | null = null;

		if (typeof target === "string") {
			const state = this.states.get(target);
			if (!state) {
				throw new Error(`State ${target} does not exist.`);
			}
			newValue = { ...state.value } as T;
			targetStateName = target;
		} else {
			newValue = { ...oldValue, ...target } as T;
		}

		const transitionConfig: TransitionConfig | undefined =
			typeof transition === "number" ? { duration: transition } : transition;

		this.handleInterrupt(oldValue, newValue, transitionConfig, targetStateName);
	}

	private handleInterrupt(
		fromValue: T,
		toValue: T,
		transition?: TransitionConfig,
		targetStateName?: string | null,
	) {
		if (this.currentTimeline) {
			this.currentTimeline.timeLine.stopTimeline();
			this.currentTimeline = null;
		}

		const d = transition?.duration ?? this.defaultTransition.duration;
		const map = transition?.map ?? this.defaultTransition.map ?? ((x) => x);

		const timeLine = this.createTimeLine(d, (progress) => {
			const mappedProgress = map(progress);
			const value = this.interpolate(fromValue, toValue, mappedProgress);
			this.currentValue = value;
			this.updateCallback?.(value);
		});

		this.currentTimeline = {
			fromValue,
			toValue,
			timeLine,
			fromStateName: this.currentStateName ?? undefined,
			toStateName: targetStateName ?? undefined,
		};

		this.currentStateName = targetStateName ?? null;
		timeLine.start();
	}
}
