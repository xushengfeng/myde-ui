import { describe, it, expect } from "vitest";
import { AnimationGear, type Time, type TimeerHandler } from "../main";

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
				// 双缓冲，防止在回调中又注册了新的回调，导致无限循环
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
	it("开关", () => {
		const timeInstance = new time();
		const gear = new AnimationGear(
			{
				on: { name: "on", next: ["off"] },
				off: { name: "off", next: ["on"] },
			},
			{
				time: timeInstance,
			},
		);
		const values: number[] = [];
		let currentValue = 0;
		gear.setTransition(
			"on",
			"off",
			(num) => {
				values.push(num);
				currentValue = num;
			},
			{
				forward: { duration: 100, map: (x) => x },
				backward: { duration: 100 },
			},
		);
		gear.moveToState("off");
		timeInstance.tickMore(116);
		expect(currentValue).toBe(1);
		gear.moveToState("on");
		timeInstance.tickMore(116);
		expect(currentValue).toBe(0);
		checkValues(values, 16 / 100);
	});
	it("开关打断", () => {
		const timeInstance = new time();
		const gear = new AnimationGear(
			{
				on: { name: "on", next: ["off"] },
				off: { name: "off", next: ["on"] },
			},
			{
				time: timeInstance,
			},
		);
		const values: number[] = [];
		gear.setTransition(
			"on",
			"off",
			(num) => {
				values.push(num);
			},
			{
				forward: { duration: 100, map: (x) => x },
				backward: { duration: 100 },
			},
		);
		gear.moveToState("off");
		timeInstance.tickMore(75);
		gear.moveToState("on");
		timeInstance.tickMore(116);
		checkValues(values, 16 / 100);
	});
});
