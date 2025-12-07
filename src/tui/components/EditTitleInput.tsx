/**
 * EditTitleInput Component
 *
 * Input field for editing a task title inline in the list view.
 */

import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useTuiActorRef, useTuiSelector } from "../machines/index.ts";
import { theme } from "./theme.ts";

export function EditTitleInput(): React.ReactElement {
  const actorRef = useTuiActorRef();
  const editingTitleText = useTuiSelector(
    (state) => state.context.editingTitleText,
  );

  const handleChange = (value: string) => {
    actorRef.send({ type: "UPDATE_EDITING_TITLE", value });
  };

  const handleSubmit = () => {
    actorRef.send({ type: "SUBMIT" });
  };

  return (
    <Box
      borderStyle={theme.borders.unfocused}
      borderColor={theme.colors.primary}
      marginBottom={1}
    >
      <Text>
        Edit: <Text dimColor>│</Text>
      </Text>
      <TextInput
        value={editingTitleText}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
