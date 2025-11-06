export interface MidiNote {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
}

export interface KeyState {
  id: number;
  pressed: boolean;
}

export interface GameNote extends MidiNote {
  id: string;
  active: boolean;
  hit: boolean;
  missed: boolean;
}
