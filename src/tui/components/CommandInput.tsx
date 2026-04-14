/**
 * CommandInput Component
 *
 * Vim-like command prompt (`:w`, etc.). Opens when user presses `:` from
 * list or detail view.
 */

import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useTuiActorRef, useTuiSelector } from "../machines/index.ts";
import { theme } from "./theme.ts";

export function CommandInput(): React.ReactElement {
  const actorRef = useTuiActorRef();
  const commandText = useTuiSelector((state) => state.context.commandText);
  const error = useTuiSelector((state) => state.context.error);

  useInput((_input, key) => {
    if (key.escape) {
      actorRef.send({ type: "CANCEL" });
      return;
    }
    // Vim parity: backspace on an empty prompt exits command mode.
    if ((key.backspace || key.delete) && commandText === "") {
      actorRef.send({ type: "CANCEL" });
    }
  });

  const handleChange = (value: string) => {
    actorRef.send({ type: "UPDATE_COMMAND_TEXT", value });
  };

  const handleSubmit = () => {
    actorRef.send({ type: "SUBMIT_COMMAND" });
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box
        borderStyle={theme.borders.unfocused}
        borderColor={theme.colors.accent}
      >
        <Text color={theme.colors.accent}>:</Text>
        <TextInput
          value={commandText}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder="command"
        />
      </Box>
      {error && (
        <Box>
          <Text color={theme.colors.error}>{error}</Text>
        </Box>
      )}
    </Box>
  );
}
