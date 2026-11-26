import { render } from "preact";
import { App } from "./App.tsx";
import problems from "./generated/problems.json";
import type { Problem } from "./problem.ts";
import "./style.css";

const root = document.getElementById("app");
if (!root) throw new Error("index.html has no #app element");
render(<App problems={problems as Problem[]} />, root);
