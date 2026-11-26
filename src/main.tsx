import { render } from "preact";
import { App } from "./App.tsx";
import data from "./generated/problems.json";
import type { ProblemData } from "./problem.ts";
import "./style.css";

render(<App problems={(data as ProblemData).problems} />, document.getElementById("app")!);
