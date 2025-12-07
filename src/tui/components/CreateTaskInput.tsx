/**
 * CreateTaskInput Component
 *
 * Input field for creating a new task.
 */

import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useTuiActorRef, useTuiSelector } from "../machines/index.ts";
import { theme } from "./theme.ts";

export function CreateTaskInput(): React.ReactElement {
  const actorRef = useTuiActorRef();
  const newTaskTitle = useTuiSelector((state) => state.context.newTaskTitle);
  const newTaskParentId = useTuiSelector(
    (state) => state.context.newTaskParentId,
  );
  const isSubtask = newTaskParentId !== null;

  const handleChange = (value: string) => {
    actorRef.send({ type: "UPDATE_TITLE", value });
  };

  const handleSubmit = () => {
    actorRef.send({ type: "SUBMIT" });
  };

  const label = isSubtask ? "New Subtask" : "New";

  return (
    <Box
      borderStyle={theme.borders.unfocused}
      borderColor={theme.colors.warning}
      marginBottom={1}
    >
      <Text>
        {label}: <Text dimColor>│</Text>
      </Text>
      <TextInput
        value={newTaskTitle}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
