import { render } from "preact";
import { App } from "./App.tsx";
import problems from "./generated/problems.json";
import type { Problem } from "./problem.ts";
import "./style.css";

render(<App problems={problems as Problem[]} />, document.getElementById("app")!);
