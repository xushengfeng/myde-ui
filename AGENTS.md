# AGENTS.md

## 项目结构

- `main.ts` - 动画引擎 AnimationGear
- `example/` - 示例项目
- `test/` - 测试文件

## 动画引擎关键概念

动画引擎纯js，除了`requestAnimationFrame`没有其他dom api，因此只是引擎，可驱动tui等。

类似于css的transition，但是可以自定义不同的插值属性，同时控制每次变换的时间和曲线

### 新API设计（泛型支持）

AnimationGear现在支持泛型，可以定义多值状态：

```ts
type State = { x: number; y: number; opacity: number };

const gear = new AnimationGear<State>(
    { x: 0, y: 0, opacity: 1 }, // 初始值
    {
        time?: Time, // 可选时间源
        transition?: { // 默认transition配置
            duration: 300,
            map: (x) => x // 可选缓动曲线
        }
    }
);
```

### 命名状态

通过`addState`添加命名状态：

```ts
gear.addState("start", { x: 0, y: 0, opacity: 1 }, ["end"]);
gear.addState("end", { x: 100, y: 50, opacity: 0.5 }, ["start"]);
```

### 移动到目标

`moveTo`支持两种模式和可选transition配置：

```ts
// 移动到命名状态（使用默认transition）
gear.moveTo("end");

// 移动到任意值（部分属性）
gear.moveTo({ x: 50, y: 25 });

// 指定duration覆盖默认值
gear.moveTo({ x: 50 }, { duration: 500 });

// 指定duration和map曲线
gear.moveTo({ x: 50 }, { duration: 500, map: (x) => x * x });

// duration=0 直接跳转无动画
gear.moveTo("start", { duration: 0 });
gear.moveTo({ x: 0, y: 0 }, 0);
```

### 更新回调

设置通用更新回调，用于任意值变化：

```ts
gear.setUpdateCallback((state) => {
    element.style.transform = `translate(${state.x}px, ${state.y}px)`;
});
```

### 打断动画

动画打断逻辑，从当前视觉值开始新动画

## dkh-ui 使用

链式调用，无 JSX：

```ts
view()
    .style({})
    .add([txt("text")])
    .addInto();
```

## 项目相关

vite ts pnpm vitest测试 biome格式化

dkh-ui 用于方便控制dom
