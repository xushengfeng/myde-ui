import { describe, expect, it } from "vitest";
import { AnimationGear, type Time, type TimeerHandler } from "../src/index";

class time implements Time {
	private currentTime: number = 0;
	private timeouts: Map<
		TimeerHandler,
		{ callback: () => void; triggerTime: number }
	> = new Map();
	private frameCallbacks: (() => void)[] = [];
	getTimeMs(): number {
		return this.currentTime;
	}
	tick() {
		this.currentTime += 1;
		if (this.timeouts.size > 0) {
			for (const [
				handler,
				{ callback, triggerTime },
			] of this.timeouts.entries()) {
				if (this.currentTime === triggerTime) {
					callback();
					this.timeouts.delete(handler);
				}
			}
		}
		if (this.frameCallbacks.length > 0) {
			if (this.currentTime % 16 === 0) {
				const cbs = [...this.frameCallbacks];
				this.frameCallbacks = [];
				for (const callback of cbs) {
					callback();
				}
			}
		}
	}
	tickMore(ms: number) {
		for (let i = 0; i < ms; i++) {
			this.tick();
		}
	}
	clearTimeOut(handler: TimeerHandler): void {
		this.timeouts.delete(handler);
	}
	setTimeOut(ms: number, callback: () => void): TimeerHandler {
		const handler = Symbol() as unknown as TimeerHandler;
		this.timeouts.set(handler, {
			callback,
			triggerTime: this.currentTime + ms,
		});
		return handler;
	}
	reqNextFrame(callback: () => void): void {
		this.frameCallbacks.push(callback);
	}
}

describe("time", () => {
	it("tick", () => {
		const timeInstance = new time();
		expect(timeInstance.getTimeMs()).toBe(0);
		timeInstance.tick();
		expect(timeInstance.getTimeMs()).toBe(1);
		timeInstance.tickMore(10);
		expect(timeInstance.getTimeMs()).toBe(11);
	});
	it("setTimeOut", () => {
		const timeInstance = new time();
		let called = false;
		timeInstance.setTimeOut(5, () => {
			called = true;
		});
		timeInstance.tickMore(4);
		expect(called).toBe(false);
		timeInstance.tick();
		expect(called).toBe(true);
	});
	it("clearTimeOut", () => {
		const timeInstance = new time();
		let called = false;
		const handler = timeInstance.setTimeOut(5, () => {
			called = true;
		});
		timeInstance.clearTimeOut(handler);
		timeInstance.tickMore(5);
		expect(called).toBe(false);
	});
	it("reqNextFrame", () => {
		const timeInstance = new time();
		let called = false;
		timeInstance.reqNextFrame(() => {
			called = true;
		});
		timeInstance.tickMore(15);
		expect(called).toBe(false);
		timeInstance.tick();
		expect(called).toBe(true);
	});
});

describe("简单测试", () => {
	function checkValues(values: number[], dv: number) {
		for (let i = 0; i < values.length; i++) {
			const next = values[i + 1];
			if (next !== undefined) {
				expect(Math.abs(next - values[i])).lessThanOrEqual(dv + 0.02);
			}
		}
	}

	it("开关（命名状态）", () => {
		const timeInstance = new time();
		type State = { value: number };
		const gear = new AnimationGear<State>(
			{ value: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		gear.addState("on", { value: 1 }, ["off"]);
		gear.addState("off", { value: 0 }, ["on"]);

		const values: number[] = [];
		let currentValue = 0;

		gear.setUpdateCallback((state) => {
			values.push(state.value);
			currentValue = state.value;
		});

		gear.moveTo("off", 0);
		gear.moveTo("on");
		timeInstance.tickMore(116);
		expect(currentValue).toBe(1);

		gear.moveTo("off");
		timeInstance.tickMore(116);
		expect(currentValue).toBe(0);

		checkValues(values, 16 / 100);
	});

	it("开关打断（命名状态）", () => {
		const timeInstance = new time();
		type State = { value: number };
		const gear = new AnimationGear<State>(
			{ value: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		gear.addState("on", { value: 1 }, ["off"]);
		gear.addState("off", { value: 0 }, ["on"]);

		const values: number[] = [];

		gear.setUpdateCallback((state) => {
			values.push(state.value);
		});

		gear.moveTo("off", 0);
		gear.moveTo("on");
		timeInstance.tickMore(75);
		gear.moveTo("off");
		timeInstance.tickMore(116);

		checkValues(values, 16 / 100);
	});

	it("任意值状态", () => {
		const timeInstance = new time();
		type State = { x: number; y: number };
		const gear = new AnimationGear<State>(
			{ x: 0, y: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		const values: State[] = [];

		gear.setUpdateCallback((state) => {
			values.push({ ...state });
		});

		gear.moveTo({ x: 100, y: 50 });
		timeInstance.tickMore(116);

		expect(values.length).toBeGreaterThan(0);
		const lastValue = values[values.length - 1];
		expect(lastValue.x).toBeCloseTo(100, 0);
		expect(lastValue.y).toBeCloseTo(50, 0);
	});

	it("CSS风格打断", () => {
		const timeInstance = new time();
		type State = { x: number };
		const gear = new AnimationGear<State>(
			{ x: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		const values: number[] = [];

		gear.setUpdateCallback((state) => {
			values.push(state.x);
		});

		gear.moveTo({ x: 100 });
		timeInstance.tickMore(50);

		gear.moveTo({ x: 50 });
		timeInstance.tickMore(116);

		expect(values.length).toBeGreaterThan(0);
		const lastValue = values[values.length - 1];
		expect(lastValue).toBeCloseTo(50, 0);
	});

	it("moveTo(duration=0) 等同于jumpTo", () => {
		const timeInstance = new time();
		type State = { x: number; y: number };
		const gear = new AnimationGear<State>(
			{ x: 0, y: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		let lastValue: State = { x: 0, y: 0 };
		gear.setUpdateCallback((state) => {
			lastValue = { ...state };
		});

		gear.moveTo({ x: 50, y: 25 }, { duration: 0 });

		expect(lastValue.x).toBe(50);
		expect(lastValue.y).toBe(25);
	});

	it("自定义缓动曲线", () => {
		const timeInstance = new time();
		type State = { x: number };
		const gear = new AnimationGear<State>(
			{ x: 0 },
			{
				time: timeInstance,
				transition: {
					duration: 100,
					map: (x) => x * x,
				},
			},
		);

		const values: number[] = [];

		gear.setUpdateCallback((state) => {
			values.push(state.x);
		});

		gear.moveTo({ x: 100 });
		timeInstance.tickMore(50);

		expect(values.length).toBeGreaterThan(0);
		const midValue = values[Math.floor(values.length / 2)];
		expect(midValue).toBeLessThan(50);
	});

	it("moveTo覆盖duration", () => {
		const timeInstance = new time();
		type State = { x: number };
		const gear = new AnimationGear<State>(
			{ x: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		let lastValue: State = { x: 0 };
		gear.setUpdateCallback((state) => {
			lastValue = { ...state };
		});

		gear.moveTo({ x: 100 });
		timeInstance.tickMore(50);

		gear.moveTo({ x: 200 }, { duration: 200 });
		timeInstance.tickMore(216);

		expect(lastValue.x).toBeCloseTo(200, 0);
	});

	it("moveTo传入map曲线", () => {
		const timeInstance = new time();
		type State = { x: number };
		const gear = new AnimationGear<State>(
			{ x: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		const values: number[] = [];

		gear.setUpdateCallback((state) => {
			values.push(state.x);
		});

		gear.moveTo({ x: 100 });
		timeInstance.tickMore(50);

		gear.moveTo({ x: 200 }, { duration: 100, map: (x) => x * x });
		timeInstance.tickMore(116);

		expect(values.length).toBeGreaterThan(0);
		const midIndex = Math.floor(values.length / 2);
		const midValue = values[midIndex];
		expect(midValue).toBeLessThan(150);
	});
});

describe("打断测试", () => {
	function checkValues(values: number[], dv: number) {
		for (let i = 0; i < values.length; i++) {
			const next = values[i + 1];
			if (next !== undefined) {
				expect(Math.abs(next - values[i])).lessThanOrEqual(dv + 0.02);
			}
		}
	}

	function checkInterrupt(values: number[]) {
		// 找到打断点：值突然变大的位置
		for (let i = 1; i < values.length - 1; i++) {
			const prev = values[i - 1];
			const curr = values[i];
			const next = values[i + 1];
			// 如果当前值比前后值都大，可能是打断点
			if (curr > prev && curr > next) {
				// 检查打断点前后的值是否连续
				const diff = Math.abs(curr - prev);
				expect(diff).toBeLessThan(2); // 允许小误差
			}
		}
	}

	it("反解打断：两状态来回切换", () => {
		const timeInstance = new time();
		type State = { value: number };
		const gear = new AnimationGear<State>(
			{ value: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		gear.addState("on", { value: 1 }, ["off"]);
		gear.addState("off", { value: 0 }, ["on"]);

		const values: number[] = [];

		gear.setUpdateCallback((state) => {
			values.push(state.value);
		});

		gear.moveTo("on");
		timeInstance.tickMore(50);

		gear.moveTo("off");
		timeInstance.tickMore(116);

		checkValues(values, 16 / 100);

		expect(values[values.length - 1]).toBeCloseTo(0, 0);
	});

	it("CSS风格打断：改变目标值", () => {
		const timeInstance = new time();
		type State = { x: number };
		const gear = new AnimationGear<State>(
			{ x: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		const values: number[] = [];

		gear.setUpdateCallback((state) => {
			values.push(state.x);
		});

		gear.moveTo({ x: 100 });
		timeInstance.tickMore(30);

		gear.moveTo({ x: 50 });
		timeInstance.tickMore(116);

		// 检查打断瞬间的值是否连续
		checkInterrupt(values);

		expect(values[values.length - 1]).toBeCloseTo(50, 0);
	});

	it("快速连续打断", () => {
		const timeInstance = new time();
		type State = { x: number };
		const gear = new AnimationGear<State>(
			{ x: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		const values: number[] = [];

		gear.setUpdateCallback((state) => {
			values.push(state.x);
		});

		gear.moveTo({ x: 100 });
		timeInstance.tickMore(20);

		gear.moveTo({ x: 200 });
		timeInstance.tickMore(20);

		gear.moveTo({ x: 150 });
		timeInstance.tickMore(116);

		// 检查打断瞬间的值是否连续
		checkInterrupt(values);

		expect(values[values.length - 1]).toBeCloseTo(150, 0);
	});

	it("多值状态打断", () => {
		const timeInstance = new time();
		type State = { x: number; y: number };
		const gear = new AnimationGear<State>(
			{ x: 0, y: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		const xValues: number[] = [];
		const yValues: number[] = [];

		gear.setUpdateCallback((state) => {
			xValues.push(state.x);
			yValues.push(state.y);
		});

		gear.moveTo({ x: 100, y: 100 });
		timeInstance.tickMore(30);

		gear.moveTo({ x: 50, y: 50 });
		timeInstance.tickMore(116);

		// 检查打断瞬间的值是否连续
		checkInterrupt(xValues);
		checkInterrupt(yValues);

		expect(xValues[xValues.length - 1]).toBeCloseTo(50, 0);
		expect(yValues[yValues.length - 1]).toBeCloseTo(50, 0);
	});

	it("打断后继续动画", () => {
		const timeInstance = new time();
		type State = { x: number };
		const gear = new AnimationGear<State>(
			{ x: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		const values: number[] = [];

		gear.setUpdateCallback((state) => {
			values.push(state.x);
		});

		gear.moveTo({ x: 100 });
		timeInstance.tickMore(30);

		gear.moveTo({ x: 50 });
		timeInstance.tickMore(50);

		gear.moveTo({ x: 100 });
		timeInstance.tickMore(116);

		// 检查打断瞬间的值是否连续
		checkInterrupt(values);

		expect(values[values.length - 1]).toBeCloseTo(100, 0);
	});
});
