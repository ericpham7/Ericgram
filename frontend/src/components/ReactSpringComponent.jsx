import { useSpring } from "react-spring";

const ReactSpringComponent = () => {
  const props = useSpring({
    from: { opacity: 0 },
    to: { opacity: 1 },
  });
  return (
    <animated.div style={props}>
      <h1>React Animated Component</h1>
    </animated.div>
  );
};

export default ReactSpringComponent;
