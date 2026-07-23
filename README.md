# myde-ui

AnimationGear - 一个纯 JavaScript 动画引擎，没有其他 DOM API，可用于驱动 TUI 等场景。

支持打断动画，在类似CSS Transition逻辑下为任意值添加插值和动画管理。也能实现循环动画。

## 安装

```bash
pnpm add myde-ui
```

## 使用

```ts
import { AnimationGear } from "myde-ui";

type State = { x: number; y: number; opacity: number };

const gear = new AnimationGear<State>(
    { x: 0, y: 0, opacity: 1 },
    {
        transition: {
            duration: 300,
            map: (x) => x
        }
    }
);

// 添加命名状态
gear.addState("start", { x: 0, y: 0, opacity: 1 }, ["end"]);
gear.addState("end", { x: 100, y: 100, opacity: 0 }, ["start"]);

// 设置更新回调
gear.setUpdateCallback((state) => {
    element.style.transform = `translate(${state.x}px, ${state.y}px)`;
    element.style.opacity = state.opacity;
});

// 移动到目标状态
gear.moveTo("end");

// 或移动到任意值
gear.moveTo({ x: 50, y: 25 });

// 指定临时 duration 和缓动曲线
gear.moveTo({ x: 50 }, { duration: 500, map: (x) => x * x });

// duration=0 直接跳转无动画
gear.moveTo("start", 0);

// 循环动画
gear.addState("loop", [{ name: "loop", onComplete: () => gear.moveTo("loop") }])
```

## API

见[AGENTS.md](AGENTS.md)

## License

[Apache-2.0](LICENSE)
