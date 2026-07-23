import { describe, expect, it } from "vitest";
import {
	AnimationGear,
	type Time,
	type TimeerHandler,
	timingFunction,
} from "../src/index";

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

describe("timing-functions", () => {
	it("linear函数", () => {
		expect(timingFunction.linear(0)).toBe(0);
		expect(timingFunction.linear(0.5)).toBe(0.5);
		expect(timingFunction.linear(1)).toBe(1);
		expect(timingFunction.linear(0.25)).toBe(0.25);
	});

	it("ease函数", () => {
		expect(timingFunction.ease(0)).toBe(0);
		expect(timingFunction.ease(1)).toBe(1);
		// ease在中间应该比线性快
		expect(timingFunction.ease(0.5)).toBeGreaterThan(0.5);
	});

	it("easeIn函数", () => {
		expect(timingFunction.easeIn(0)).toBe(0);
		expect(timingFunction.easeIn(1)).toBe(1);
		// easeIn在开始应该比线性慢
		expect(timingFunction.easeIn(0.25)).toBeLessThan(0.25);
	});

	it("easeOut函数", () => {
		expect(timingFunction.easeOut(0)).toBe(0);
		expect(timingFunction.easeOut(1)).toBe(1);
		// easeOut在开始应该比线性快
		expect(timingFunction.easeOut(0.25)).toBeGreaterThan(0.25);
	});

	it("easeInOut函数", () => {
		expect(timingFunction.easeInOut(0)).toBe(0);
		expect(timingFunction.easeInOut(1)).toBe(1);
		// easeInOut在开始应该比线性慢，在结束应该比线性快
		expect(timingFunction.easeInOut(0.25)).toBeLessThan(0.25);
		expect(timingFunction.easeInOut(0.75)).toBeGreaterThan(0.75);
	});

	it("createCubicBezier函数", () => {
		const custom = timingFunction.cubicBezier(0.5, 0, 0.5, 1);
		expect(custom(0)).toBe(0);
		expect(custom(1)).toBe(1);
		expect(custom(0.5)).toBeGreaterThan(0);
		expect(custom(0.5)).toBeLessThan(1);
	});

	it("timing-function在AnimationGear中使用", () => {
		const timeInstance = new time();
		type State = { x: number };
		const gear = new AnimationGear<State>(
			{ x: 0 },
			{
				time: timeInstance,
				transition: {
					duration: 100,
					map: timingFunction.easeInOut,
				},
			},
		);

		const values: number[] = [];

		gear.setUpdateCallback((state) => {
			values.push(state.x);
		});

		gear.moveTo({ x: 100 });
		timeInstance.tickMore(116);

		expect(values.length).toBeGreaterThan(0);
		const lastValue = values[values.length - 1];
		expect(lastValue).toBeCloseTo(100, 0);
	});

	it("timing-function在moveTo中使用", () => {
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

		gear.moveTo({ x: 100 }, { duration: 100, map: timingFunction.easeIn });
		timeInstance.tickMore(116);

		expect(values.length).toBeGreaterThan(0);
		const lastValue = values[values.length - 1];
		expect(lastValue).toBeCloseTo(100, 0);
	});
});

describe("addState 配置", () => {
	it("简单连接", () => {
		const timeInstance = new time();
		type State = { x: number };
		const gear = new AnimationGear<State>(
			{ x: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		gear.addState("start", { x: 0 }, ["end"]);
		gear.addState("end", { x: 100 }, ["start"]);

		let lastValue: State = { x: 0 };
		gear.setUpdateCallback((state) => {
			lastValue = { ...state };
		});

		gear.moveTo("start", 0);
		gear.moveTo("end");
		timeInstance.tickMore(116);

		expect(lastValue.x).toBeCloseTo(100, 0);
	});

	it("带配置的连接", () => {
		const timeInstance = new time();
		type State = { x: number };
		const gear = new AnimationGear<State>(
			{ x: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		gear.addState("start", { x: 0 }, ["end"]);
		gear.addState("end", { x: 100 }, [
			{ name: "start", duration: 200 }
		]);

		let lastValue: State = { x: 0 };
		gear.setUpdateCallback((state) => {
			lastValue = { ...state };
		});

		// 从 start 到 end，使用全局配置 (duration: 100)
		gear.moveTo("start", 0);
		gear.moveTo("end");
		timeInstance.tickMore(116);
		expect(lastValue.x).toBeCloseTo(100, 0);

		// 从 end 到 start，使用状态机配置 (duration: 200)
		gear.moveTo("start");
		timeInstance.tickMore(50);
		// 50ms / 200ms = 25%，应该还没完成
		expect(lastValue.x).toBeGreaterThan(0);
		timeInstance.tickMore(166);
		expect(lastValue.x).toBeCloseTo(0, 0);
	});

	it("onComplete 回调", () => {
		const timeInstance = new time();
		type State = { x: number };
		const gear = new AnimationGear<State>(
			{ x: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		let completed = false;
		gear.addState("start", { x: 0 }, ["end"]);
		gear.addState("end", { x: 100 }, [
			{ name: "start", onComplete: () => { completed = true; } }
		]);

		gear.setUpdateCallback(() => {});

		gear.moveTo("start", 0);
		gear.moveTo("end");
		timeInstance.tickMore(116);

		// 从 end 到 start 时应该触发 onComplete
		gear.moveTo("start");
		timeInstance.tickMore(116);

		expect(completed).toBe(true);
	});

	it("配置优先级", () => {
		const timeInstance = new time();
		type State = { x: number };
		const gear = new AnimationGear<State>(
			{ x: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		gear.addState("start", { x: 0 }, ["end"]);
		gear.addState("end", { x: 100 }, [
			{ name: "start", duration: 200 }
		]);

		let lastValue: State = { x: 0 };
		gear.setUpdateCallback((state) => {
			lastValue = { ...state };
		});

		gear.moveTo("start", 0);
		gear.moveTo("end");
		timeInstance.tickMore(116);
		expect(lastValue.x).toBeCloseTo(100, 0);

		// moveTo 参数应该覆盖状态机配置
		gear.moveTo("start", { duration: 50 });
		timeInstance.tickMore(66);
		expect(lastValue.x).toBeCloseTo(0, 0);
	});

	it("打断时 onComplete 不触发", () => {
		const timeInstance = new time();
		type State = { x: number };
		const gear = new AnimationGear<State>(
			{ x: 0 },
			{ time: timeInstance, transition: { duration: 100 } },
		);

		let completedCount = 0;
		gear.addState("start", { x: 0 }, ["end"]);
		gear.addState("end", { x: 100 }, [
			{ name: "start", onComplete: () => { completedCount++; } }
		]);

		gear.setUpdateCallback(() => {});

		gear.moveTo("start", 0);
		gear.moveTo("end");
		timeInstance.tickMore(116);

		// 从 end 到 start，但中途打断
		gear.moveTo("start");
		timeInstance.tickMore(50);
		// 打断，回到 end
		gear.moveTo("end");
		timeInstance.tickMore(116);

		// onComplete 不应该触发（因为被打断了）
		expect(completedCount).toBe(0);

		// 再次完整执行
		gear.moveTo("start");
		timeInstance.tickMore(216);

		// 现在应该触发了
		expect(completedCount).toBe(1);
	});
});
