import { p, txt, view } from "dkh-ui";
import { AnimationGear } from "../../src/index";

type SwitchState = {
	translateX: number;
	backgroundProgress: number;
};

function createSwitch() {
	const switchContainer = view().style({
		width: "51px",
		height: "31px",
		backgroundColor: "#E7E0EC",
		borderRadius: "15.5px",
		position: "relative",
		cursor: "pointer",
	});

	const thumb = view().style({
		width: "27px",
		height: "27px",
		backgroundColor: "#49454F",
		borderRadius: "50%",
		position: "absolute",
		top: "2px",
		left: "2px",
		boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
	});

	switchContainer.add(thumb);

	const gear = new AnimationGear<SwitchState>(
		{ translateX: 0, backgroundProgress: 0 },
		{
			transition: {
				duration: 200,
				map: (x) => x,
			},
		},
	);

	gear.addState("off", { translateX: 0, backgroundProgress: 0 }, ["on"]);
	gear.addState("on", { translateX: 20, backgroundProgress: 1 }, ["off"]);

	let isDragging = false;
	let pointerDownX = 0;
	let dragStartTranslateX = 0;
	let currentTranslateX = 0;

	gear.moveTo("off", 0);

	switchContainer.el.addEventListener("pointerdown", (e) => {
		e.preventDefault();
		switchContainer.el.setPointerCapture(e.pointerId);
		pointerDownX = e.clientX;
		dragStartTranslateX = currentTranslateX;
		isDragging = false;
	});

	switchContainer.el.addEventListener("pointermove", (e) => {
		if (pointerDownX === 0) return;

		const deltaX = e.clientX - pointerDownX;

		if (!isDragging && Math.abs(deltaX) > 2) {
			isDragging = true;
		}

		if (isDragging) {
			const targetTranslateX = dragStartTranslateX + deltaX;
			const clampedX = Math.max(0, Math.min(20, targetTranslateX));
			gear.moveTo(
				{ translateX: clampedX, backgroundProgress: clampedX / 20 },
				0,
			);
		}
	});

	switchContainer.el.addEventListener("pointerup", () => {
		if (isDragging) {
			const isOn = currentTranslateX > 10;
			gear.moveTo(isOn ? "on" : "off");
			updateLabel();
		} else {
			const isOn = gear.currentStateName === "on";
			gear.moveTo(isOn ? "off" : "on");
			updateLabel();
		}

		pointerDownX = 0;
		isDragging = false;
	});

	switchContainer.el.addEventListener("pointercancel", () => {
		pointerDownX = 0;
		isDragging = false;
	});

	gear.setUpdateCallback((state) => {
		thumb.el.style.transform = `translateX(${state.translateX}px)`;
		currentTranslateX = state.translateX;

		const trackColorR = Math.round(
			231 * (1 - state.backgroundProgress) + 103 * state.backgroundProgress,
		);
		const trackColorG = Math.round(
			224 * (1 - state.backgroundProgress) + 80 * state.backgroundProgress,
		);
		const trackColorB = Math.round(
			236 * (1 - state.backgroundProgress) + 164 * state.backgroundProgress,
		);
		switchContainer.el.style.backgroundColor = `rgb(${trackColorR},${trackColorG},${trackColorB})`;

		const thumbColorR = Math.round(
			73 * (1 - state.backgroundProgress) + 255 * state.backgroundProgress,
		);
		const thumbColorG = Math.round(
			69 * (1 - state.backgroundProgress) + 251 * state.backgroundProgress,
		);
		const thumbColorB = Math.round(
			79 * (1 - state.backgroundProgress) + 254 * state.backgroundProgress,
		);
		thumb.el.style.backgroundColor = `rgb(${thumbColorR},${thumbColorG},${thumbColorB})`;
	});

	const label = txt("关").style({
		fontSize: "14px",
		color: "#1C1B1F",
		marginTop: "5px",
		display: "block",
	});

	function updateLabel() {
		const isOn = gear.currentStateName === "on";
		label.sv(isOn ? "开" : "关");
	}

	const wrapper = view()
		.style({
			display: "flex",
			flexDirection: "column",
			alignItems: "flex-start",
		})
		.add([switchContainer, label]);

	return {
		element: wrapper,
	};
}

function createSortAnimation() {
	type SortItemState = {
		x: number;
		y: number;
		scale: number;
		opacity: number;
	};

	const container = view().style({
		position: "relative",
		height: "40px",
	});

	const items: {
		element: ReturnType<typeof view>;
		gear: AnimationGear<SortItemState>;
		value: number;
	}[] = [];

	const initialValues = [3, 1, 4, 1, 5, 9, 2, 6];

	const materialColors = [
		"#6750A4",
		"#625B71",
		"#7D5260",
		"#006C51",
		"#0061A4",
		"#9C4234",
		"#4A6267",
		"#7C5800",
	];

	for (let i = 0; i < initialValues.length; i++) {
		const value = initialValues[i];
		const color = materialColors[i % materialColors.length];
		const element = view()
			.style({
				width: "40px",
				height: "40px",
				backgroundColor: color,
				borderRadius: "4px",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				color: "#FFFBFE",
				fontWeight: "bold",
				position: "absolute",
			})
			.add([txt(`${value}`)]);

		const gear = new AnimationGear<SortItemState>(
			{
				x: i * 50,
				y: 0,
				scale: 1,
				opacity: 1,
			},
			{
				transition: {
					duration: 500,
					map: (x) => x,
				},
			},
		);

		gear.setUpdateCallback((state) => {
			element.el.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
			element.el.style.opacity = `${state.opacity}`;
		});

		gear.moveTo({ x: i * 50, y: 0, scale: 1, opacity: 1 }, 0);

		container.add(element);
		items.push({ element, gear, value });
	}

	const shuffleBtn = view()
		.style({
			padding: "8px 16px",
			backgroundColor: "#6750A4",
			color: "#FFFBFE",
			border: "none",
			borderRadius: "20px",
			cursor: "pointer",
			marginTop: "20px",
			fontSize: "14px",
			fontWeight: "500",
			letterSpacing: "0.1px",
		})
		.add([txt("随机乱序")]);

	shuffleBtn.el.addEventListener("click", () => {
		for (let i = items.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[items[i], items[j]] = [items[j], items[i]];
		}

		items.forEach((item, index) => {
			item.gear.moveTo({ x: index * 50 });
		});
	});

	const sortBtn = view()
		.style({
			padding: "8px 16px",
			backgroundColor: "#625B71",
			color: "#FFFBFE",
			border: "none",
			borderRadius: "20px",
			cursor: "pointer",
			marginTop: "20px",
			marginLeft: "10px",
			fontSize: "14px",
			fontWeight: "500",
			letterSpacing: "0.1px",
		})
		.add([txt("排序")]);

	sortBtn.el.addEventListener("click", async () => {
		[...items]
			.sort((a, b) => a.value - b.value)
			.forEach((item, index) => {
				item.gear.moveTo({ x: index * 50 });
			});
	});

	const wrapper = view()
		.style({
			marginTop: "40px",
		})
		.add([
			p("排序动画示例"),
			container,
			view()
				.style({
					display: "flex",
					gap: "10px",
					marginTop: "10px",
				})
				.add([shuffleBtn, sortBtn]),
		]);

	return wrapper;
}

const { element: switchElement } = createSwitch();
const sortElement = createSortAnimation();

view()
	.add([p("开关示例"), switchElement, sortElement])
	.addInto();
