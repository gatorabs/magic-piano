import { useState, useCallback } from "react";
import { Midi } from "@tonejs/midi";
import { MidiNote } from "@/types/midi";

export const useMidiParser = () => {
  const [notes, setNotes] = useState<MidiNote[]>([]);
  const [fileName, setFileName] = useState<string>("");

  const parseMidiFile = useCallback(async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const midi = new Midi(arrayBuffer);
      
      const allNotes: MidiNote[] = [];
      midi.tracks.forEach((track) => {
        track.notes.forEach((note) => {
          allNotes.push({
            midi: note.midi,
            time: note.time,
            duration: note.duration,
            velocity: note.velocity,
          });
        });
      });

      // Sort by time
      allNotes.sort((a, b) => a.time - b.time);
      
      setNotes(allNotes);
      setFileName(file.name);
      return allNotes;
    } catch (error) {
      console.error("Error parsing MIDI:", error);
      throw error;
    }
  }, []);

  const clearMidi = useCallback(() => {
    setNotes([]);
    setFileName("");
  }, []);

  return {
    notes,
    fileName,
    parseMidiFile,
    clearMidi,
  };
};
