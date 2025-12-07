import React from "react";
import { render } from "ink";
import { App } from "./app.tsx";
import { MockTaskClient } from "./mock_client.ts";

const client = new MockTaskClient();
render(<App client={client} />);
