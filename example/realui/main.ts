import { p, txt, view } from "dkh-ui";
import { AnimationGear } from "../../main";

// 创建开关
function createSwitch() {
	// 开关容器
	const switchContainer = view().style({
		width: "51px",
		height: "31px",
		backgroundColor: "#e9e9eb",
		borderRadius: "15.5px",
		position: "relative",
		cursor: "pointer",
	});

	// 开关滑块
	const thumb = view().style({
		width: "27px",
		height: "27px",
		backgroundColor: "white",
		borderRadius: "50%",
		position: "absolute",
		top: "2px",
		left: "2px",
		boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
	});

	switchContainer.add(thumb);

	// 状态
	let isOn = false;

	// 动画引擎
	const gear = new AnimationGear({
		off: { name: "off", next: ["on"] },
		on: { name: "on", next: ["off"] },
	});

	// 设置过渡动画
	gear.setTransition(
		"off",
		"on",
		(progress) => {
			// 进度从0到1：从关到开（左到右）
			// 进度从1到0：从开到关（右到左）
			const translateX = progress * 20; // 移动20px
			thumb.el.style.transform = `translateX(${translateX}px)`;

			// 背景颜色插值 (灰色 -> 蓝色)
			const r = Math.round(233 * (1 - progress));
			const g = Math.round(233 + (122 - 233) * progress);
			const b = Math.round(235 + (255 - 235) * progress);
			switchContainer.el.style.backgroundColor = `rgb(${r},${g},${b})`;
		},
		{
			forward: { duration: 300, map: (x) => x },
			backward: { duration: 300 },
		},
	);

	// 切换状态
	function toggle() {
		if (isOn) {
			gear.moveToState("off");
		} else {
			gear.moveToState("on");
		}
		isOn = !isOn;
		updateLabel();
	}

	// 状态标签
	const label = txt(isOn ? "开" : "关").style({
		fontSize: "14px",
		color: "#1d1d1f",
		marginTop: "5px",
		display: "block",
	});

	function updateLabel() {
		label.sv(isOn ? "开" : "关");
	}

	// 初始化为关状态
	thumb.el.style.transform = "translateX(0px)";
	switchContainer.el.style.backgroundColor = "#e9e9eb";

	// 点击事件
	switchContainer.el.addEventListener("click", toggle);

	// 返回包含开关和标签的容器
	const wrapper = view()
		.style({
			display: "flex",
			flexDirection: "column",
			alignItems: "flex-start",
		})
		.add([switchContainer, label]);

	return {
		element: wrapper,
		toggle: toggle,
	};
}

const { element: switchElement } = createSwitch();
view()
	.add([p("开关示例"), switchElement])
	.addInto();
