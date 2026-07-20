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
	let isDragging = false;
	let isPendingDrag = false;
	let dragStartX = 0;
	let currentTranslateX = 0;

	// 动画引擎
	const gear = new AnimationGear({
		off: { name: "off", next: ["on", "drag"] },
		on: { name: "on", next: ["off", "drag"] },
		drag: { name: "drag", next: ["on", "off"] },
	});

	// 设置过渡动画 (off <-> on)
	gear.setTransition(
		"off",
		"on",
		(progress) => {
			const translateX = progress * 20;
			updateUI(translateX, progress);
		},
		{
			forward: { duration: 300, map: (x) => x },
			backward: { duration: 300 },
		},
	);

	// 设置过渡动画 (off -> drag, 时长为0)
	gear.setTransition("off", "drag", () => {}, {
		forward: { duration: 0, map: (x) => x },
		backward: { duration: 0 },
	});

	// 设置过渡动画 (on -> drag, 时长为0)
	gear.setTransition("on", "drag", () => {}, {
		forward: { duration: 0, map: (x) => x },
		backward: { duration: 0 },
	});

	// 更新 UI 的函数
	function updateUI(translateX: number, progress?: number) {
		thumb.el.style.transform = `translateX(${translateX}px)`;
		currentTranslateX = translateX;

		// 计算颜色进度 (0-1)
		const colorProgress = progress !== undefined ? progress : translateX / 20;

		// 背景颜色插值
		const r = Math.round(233 * (1 - colorProgress));
		const g = Math.round(233 + (122 - 233) * colorProgress);
		const b = Math.round(235 + (255 - 235) * colorProgress);
		switchContainer.el.style.backgroundColor = `rgb(${r},${g},${b})`;
	}

	// 动态创建 drag -> on/off 的 transition
	function createDragReleaseTransition(targetState: string) {
		const targetTranslateX = targetState === "on" ? 20 : 0;
		const startTranslateX = currentTranslateX;
		const distance = targetTranslateX - startTranslateX;
		const startColorProgress = startTranslateX / 20;
		const targetColorProgress = targetTranslateX / 20;
		const colorDistance = targetColorProgress - startColorProgress;

		gear.setTransition(
			"drag",
			targetState,
			(progress) => {
				// progress 0->1 对应从当前位置到目标位置
				const translateX = startTranslateX + distance * progress;
				// 计算颜色进度
				const colorProgress = startColorProgress + colorDistance * progress;
				updateUI(translateX, colorProgress);
			},
			{
				forward: { duration: 200, map: (x) => x },
				backward: { duration: 200 },
			},
		);
	}

	// 拖拽开始（只记录起始位置）
	function onDragStart(clientX: number) {
		isPendingDrag = true;
		dragStartX = clientX;
	}

	function onDragMove(clientX: number) {
		if (!isPendingDrag && !isDragging) return;

		if (isPendingDrag) {
			const deltaX = Math.abs(clientX - dragStartX);
			if (deltaX > 1) {
				isPendingDrag = false;
				isDragging = true;
				gear.moveToState("drag");
			} else {
				return;
			}
		}

		const deltaX = clientX - dragStartX;
		let newTranslateX = currentTranslateX + deltaX;

		newTranslateX = Math.max(0, Math.min(20, newTranslateX));

		updateUI(newTranslateX);
		dragStartX = clientX;
	}

	function onDragEnd() {
		if (isPendingDrag) {
			isPendingDrag = false;
			toggle();
			return;
		}

		if (!isDragging) return;
		isDragging = false;

		const targetState = currentTranslateX > 10 ? "on" : "off";

		createDragReleaseTransition(targetState);

		gear.moveToState(targetState);
		isOn = targetState === "on";
		updateLabel();
	}

	function toggle() {
		if (isDragging) return;

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
	currentTranslateX = 0;
	thumb.el.style.transform = "translateX(0px)";
	switchContainer.el.style.backgroundColor = "#e9e9eb";

	// Pointer 事件（统一处理鼠标和触摸）
	switchContainer.el.addEventListener("pointerdown", (e) => {
		e.preventDefault();
		switchContainer.el.setPointerCapture(e.pointerId);
		onDragStart(e.clientX);
	});

	switchContainer.el.addEventListener("pointermove", (e) => {
		onDragMove(e.clientX);
	});

	switchContainer.el.addEventListener("pointerup", () => {
		onDragEnd();
	});

	switchContainer.el.addEventListener("pointercancel", () => {
		onDragEnd();
	});

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
