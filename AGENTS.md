# AGENTS.md

## 项目结构

- `main.ts` - 动画引擎 AnimationGear
- `example/` - 示例项目
- `test/` - 测试文件

## 动画引擎关键概念

动画引擎纯js，除了`requestAnimationFrame`没有其他dom api，因此只是引擎，可驱动tui等。

是个状态机，每个状态就是一个静态的界面，状态间切换就是过渡`transition`

### 状态图定义

第一个键是初始状态：

```ts
new AnimationGear({
    off: { name: "off", next: ["on"] }, // 初始状态
    on: { name: "on", next: ["off"] },
});
```

### 状态对

`stateTransitions` 中的两个状态不分前后，是一个状态对：

```ts
setTransition("on", "off", cb, op); // 设置 on<->off 过渡
setTransition("off", "on", cb, op); // 同上，会覆盖
```

#### 过渡方向

在`setTransition("off", "on", cb, op)`中，从`off`到`on`

- `forward`: `off` -> `on`（cb progress 0->1）
- `backward`: `on` -> `off`（cb progress 1->0）

可以给每个方向设置`duration`，还有`map`以创建缓动映射，`backward`缺省后继承`forward`属性

backward不用处理方向问题，常规从0到1缓动曲线那样设计就行了，像forward那样，map值是相对方向的。对于cb progress，则有明确的行进方向，根据setTransition前面两个参数顺序决定。这样方便映射到具体样式，比如`on`这个实例状态progress就是1，位置、颜色都可以方便确定。

### 状态切换和打断动画

打断动画是特色

通过`moveToState(state)`切换到状态并触发动画，回调cb progress将响应。如果在动画还未结束就又执行`moveToState`，引擎会计算相关数据实现视觉效果适合的、符合交互逻辑的动画打断衔接效果，如两个状态来回切换就自动反解，多个状态切换就加速等。

改变状态不关心输入源，可能是鼠标、变量修改等。

初始化界面可以用`jumpToState`无动画切换到初始界面。

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
