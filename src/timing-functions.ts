export type TimingFunction = (progress: number) => number;

function cubicBezier(
	p1x: number,
	p1y: number,
	p2x: number,
	p2y: number,
): TimingFunction {
	// 计算贝塞尔曲线系数
	const cx = 3 * p1x;
	const bx = 3 * (p2x - p1x) - cx;
	const ax = 1 - cx - bx;

	const cy = 3 * p1y;
	const by = 3 * (p2y - p1y) - cy;
	const ay = 1 - cy - by;

	// 求解t对于给定x的值
	function sampleX(t: number): number {
		return ((ax * t + bx) * t + cx) * t;
	}

	function sampleY(t: number): number {
		return ((ay * t + by) * t + cy) * t;
	}

	// 求解t的导数
	function sampleXDerivative(t: number): number {
		return (3 * ax * t + 2 * bx) * t + cx;
	}

	// 使用牛顿迭代法求解t
	function solveCurveX(x: number): number {
		let t = x;
		for (let i = 0; i < 8; i++) {
			const currentX = sampleX(t) - x;
			if (Math.abs(currentX) < 1e-6) {
				return t;
			}
			const derivative = sampleXDerivative(t);
			if (Math.abs(derivative) < 1e-6) {
				break;
			}
			t -= currentX / derivative;
		}

		// 如果牛顿迭代失败，使用二分法
		let a = 0;
		let b = 1;
		t = x;

		if (t < a) {
			return a;
		}
		if (t > b) {
			return b;
		}

		while (a < b) {
			const currentX = sampleX(t);
			if (Math.abs(currentX - x) < 1e-6) {
				return t;
			}
			if (x > currentX) {
				a = t;
			} else {
				b = t;
			}
			t = (b - a) / 2 + a;
		}

		return t;
	}

	return (x: number): number => {
		if (x <= 0) {
			return 0;
		}
		if (x >= 1) {
			return 1;
		}
		return sampleY(solveCurveX(x));
	};
}

// CSS默认timing-functions
const linear: TimingFunction = (x) => x;

const ease: TimingFunction = cubicBezier(0.25, 0.1, 0.25, 1.0);

const easeIn: TimingFunction = cubicBezier(0.42, 0, 1.0, 1.0);

const easeOut: TimingFunction = cubicBezier(0, 0, 0.58, 1.0);

const easeInOut: TimingFunction = cubicBezier(0.42, 0, 0.58, 1.0);

// 通用cubic-bezier工厂函数
function createCubicBezier(
	p1x: number,
	p1y: number,
	p2x: number,
	p2y: number,
): TimingFunction {
	return cubicBezier(p1x, p1y, p2x, p2y);
}

export const timingFunction = {
	linear,
	ease,
	easeIn,
	easeOut,
	easeInOut,
	cubicBezier: createCubicBezier,
};
