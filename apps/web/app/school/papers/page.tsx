"use client";

import { Page } from "../../ui";
import { usePortal } from "../portal";
import { SchoolTranscripts } from "../transcripts";

/** Transcripts and letters students asked for in the app. */
export default function Papers() {
  const { school, reload } = usePortal();
  return (
    <Page title="Transcripts and letters">
      <SchoolTranscripts schoolId={school.id} onChanged={reload} />
    </Page>
  );
}
