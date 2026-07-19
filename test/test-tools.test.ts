import { describe, it, expect } from "vitest";
import { getFunctionRange, findNextIntersection, findInverse } from "../main";

describe("工具函数测试", () => {
	it("getFunctionRange 基本测试", () => {
		const f = (x: number) => x * x;
		const range = getFunctionRange(f, 0, 1, 100);
		expect(range.min).toBeCloseTo(0, 5);
		expect(range.max).toBeCloseTo(1, 5);
	});

	it("getFunctionRange 弹簧函数", () => {
		// 模拟弹簧函数：衰减振荡
		const spring = (x: number) => {
			return 1 - Math.exp(-5 * x) * Math.cos(10 * Math.PI * x);
		};
		const range = getFunctionRange(spring, 0, 1, 1000);
		expect(range.min).toBeGreaterThanOrEqual(0);
		expect(range.max).toBeLessThanOrEqual(2); // 弹簧函数可能超调
	});

	it("findNextIntersection 单调函数", () => {
		const f = (x: number) => x;
		const target = 0.5;
		const result = findNextIntersection(f, target, 0, 1);
		expect(result).toBeCloseTo(0.5, 5);
	});

	it("findNextIntersection 振荡函数", () => {
		// 振荡函数，多次穿过0.5
		const f = (x: number) => {
			return 0.5 + 0.3 * Math.sin(10 * Math.PI * x);
		};
		const target = 0.5;
		// 从0开始，第一个交点应该在0.1（因为sin(10π*0.1)=sin(π)=0）
		const result = findNextIntersection(f, target, 0, 0.2);
		expect(result).not.toBeNull();
		if (result) {
			expect(result).toBeGreaterThan(0);
			expect(result).toBeLessThan(0.2);
		}
	});

	it("findNextIntersection 无解情况", () => {
		const f = (x: number) => x * x; // 值域[0,1]，但找target=2
		const result = findNextIntersection(f, 2, 0, 1);
		expect(result).toBeNull();
	});

	it("findInverse 单调函数", () => {
		const f = (x: number) => x;
		const v = 0.5;
		const result = findInverse(f, v, 0, 1);
		expect(result).toBeCloseTo(0.5, 5);
	});

	it("findInverse 振荡函数", () => {
		// 弹簧函数
		const spring = (x: number) => {
			return 1 - Math.exp(-5 * x) * Math.cos(10 * Math.PI * x);
		};
		const v = 1.0;
		const result = findInverse(spring, v, 0, 1);
		expect(result).not.toBeNull();
		if (result) {
			expect(result).toBeGreaterThan(0);
			expect(result).toBeLessThanOrEqual(1);
		}
	});

	it("findInverse 无解情况", () => {
		const f = (x: number) => x * x; // 值域[0,1]，但找target=2
		const result = findInverse(f, 2, 0, 1);
		expect(result).toBeNull();
	});
});