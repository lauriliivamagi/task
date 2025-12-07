/**
 * SearchInput Component
 *
 * Input field for searching tasks.
 */

import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useTuiActorRef, useTuiSelector } from "../machines/index.ts";
import { theme } from "./theme.ts";

export function SearchInput(): React.ReactElement {
  const actorRef = useTuiActorRef();
  const searchQuery = useTuiSelector((state) => state.context.searchQuery);

  const handleChange = (value: string) => {
    actorRef.send({ type: "UPDATE_SEARCH_QUERY", value });
  };

  const handleSubmit = () => {
    actorRef.send({ type: "SUBMIT" });
  };

  return (
    <Box
      borderStyle={theme.borders.unfocused}
      borderColor={theme.colors.accent}
      marginBottom={1}
    >
      <Text color={theme.colors.accent}>/</Text>
      <TextInput
        value={searchQuery}
        onChange={handleChange}
        onSubmit={handleSubmit}
        placeholder="Semantic search..."
      />
    </Box>
  );
}
