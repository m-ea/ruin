## Phase 3a Design Decisions
### Stat list
This list is the minimum for viable gameplay. Additional stats will be added in the future.
- Health
- Stamina
- Essence
### Stat generation
All characters should start with 100 health, 100 stamina, and 100 essence. Defer character creation UI to a later phase.
### Stat ranges/bounds
All stats should have a floor of 0. There is no ceiling value. In future versions, modifiers from equipment, consumables, and other effects will affect stats and skills.
### Body-part list
Tracked body parts are:
- Head
- Torso
- Left Arm
- Right Arm
- Left Leg
- Right Leg
### Body-part health representation
Each body part must have a current and max health value. For this version, they will each be 100. When combat is added in a future phase, damage taken by the player will reduce both the player's main health stat and the targeted body part's health.
### Stat health relationship
The maximum value of a character's health stat should have a proportional affect on the health of each body part. However, the current value should not have a relationship. For instance, when the character's maximum health value increases or decreases, so should the maximum health of each body part. However, if a character receives an effect, such as taking damage, that changes their current health, then damage will be applied to some, one, or none of body parts current health. Because the distinction depends on how the damage was inflicted, the current health of each body part should not be tightly coupled to the health stat of the character.
### Colyseus schema shape
Stats and body part health should be implemented with nested typed Schema subclass.
### Visibility to other clients
Every character's stats should be visible to the player, regardless of whether they're an NPC or controlled by a player. In the future, we may hide these values from the UI to advance game design decisions, but for debugging purposes, every character's state should be shared with every client in the room.

This raises an important clarification. Every character should have all of the systems described in this file, even if they are an NPC. Non-NPC creatures, such as monsters, will only have a subset of the stats and skills that a human character has. Such a distinction doesn't need implementation in this phase, but is good information to keep in mind as we architect this system. We want to plan for extensibility later.
### Client UI scope
This phase should include a basic HUD to indicate the player's health, stamina, and essence values. Health should be a red bar. Stamina should be a green bar. Essence should be blue bar. The bars should have a fixed width regardless of the maximum or current value. If the current value is equal to or greater than the maximum value, the bar should appear full. As the current value of each stat is reduced below the maximum value, the bar should appear to be depleted. Each bar should have centered text that displays the current and maximum values of the stat. For instance, a player with 50 current health and 100 maximum health should see that the red bar is half full, and they should see text that reads "50 / 100". If the player had 75 current and 150 max health, the bar would appear visually the same (both are at 50% health), but of course read "75 / 100".

In a future phase, we'll add a HUD panel that displays the health value for each body part. For now, those values do not need to be exposed in the UI.
### Test scope
For phase 3a, WorldRoom-level testing is not necessary. Tests should stay at the unit level only.