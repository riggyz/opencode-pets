import { Ipc } from "@opencode/plugin/gui"
import { Schema } from "effect"

const Pet = Schema.Struct({
  key: Schema.String, source: Schema.String, image: Schema.String,
  id: Schema.String, displayName: Schema.String, description: Schema.String,
  spriteVersionNumber: Schema.Literals([1, 2]), spritesheetPath: Schema.String,
})

export const Pets = Ipc.define({
  id: "riggyz-pets.catalog",
  methods: {
    list: { output: Schema.Struct({ pets: Schema.Array(Pet), errors: Schema.Array(Schema.String) }) },
  },
})
