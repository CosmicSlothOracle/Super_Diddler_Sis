# Detailed Tutorial Steps

This document provides a detailed breakdown of each step in the game's tutorial, drawing from the implementation in `js/tutorial-system.js` and the plan in `docs/TRAINING_TUTORIAL_PLAN.md`.

## Part 1: Dance Spot Tutorial

This part serves as a brief introduction to the game's premise and the player's initial goal.

*   **Objective**: Reach the music at the top of the stage.
*   **Instructions**: The tutorial begins with a modal dialog that sets the scene:
    > "La-di-da. Finally here, you are. Work that booty, you must, yes yes. Impress, you will try, hmm? Dance as flamboyant as your heart desires, you may... but watchful, you must remain. Creeping, the diddlers are. Always watching, they are. Hmm, disturbing it is. Your goal now, reach the music at the top of stage you must. Simple it seems, but fail you might. Always the girls fail first, yes yes. Doubt you, I do not... but worry, I must."

## Part 2: Combat Tutorial (Training Stage)

This part is a multi-step tutorial that introduces the core combat mechanics.

### Step 1: Basic Attacks (No Enemy)

*   **Objective**: Use every attack type once.
*   **Instructions**:
    *   Main: "Führe jetzt alle vier Angriffe aus" (Perform all four attacks now)
    *   Detail: "R1: Schneller Jab | R2: Schwerer Schlag | L1: Spezial-Angriff | L2: Geladener Angriff (halten und loslassen)" (R1: Quick Jab | R2: Heavy Punch | L1: Special Attack | L2: Charged Attack (hold and release))
*   **Tracking**: The system tracks if R1, R2, L1, and L2 have been used at least once.

### Step 2: Attack on Enemy

*   **Objective**: Use every attack type once on an enemy.
*   **Instructions**:
    *   Main: "Teste deine Angriffe jetzt an diesem Gegner" (Now test your attacks on this opponent)
    *   Detail: "Führe Angriffe auf den passiven NPC aus. Mindestens 4 Treffer erforderlich." (Perform attacks on the passive NPC. At least 4 hits required.)
*   **Implementation**: A passive NPC is spawned for the player to attack. The system tracks if each of the four attack types has hit the enemy.

### Step 3: Active NPC Fight

*   **Objective**: Fight against an active NPC until one is knocked out.
*   **Instructions**:
    *   Main: "Kämpfe jetzt gegen diesen Gegner" (Fight this opponent now)
    *   Detail: "Kämpfe bis einer von euch K.O. geht. Nutze alles, was du gelernt hast." (Fight until one of you is K.O. Use everything you have learned.)
*   **Implementation**: The NPC from the previous step becomes active and fights the player. The step is complete when either the player or the NPC is eliminated.

### Additional Part 2 Modal Dialogs

The tutorial in Part 2 is guided by a character who speaks in a particular style. Here are some of the key dialogs:

*   **Dojo Welcome**:
    > "Konnichiwa, hmm. Welcome to the dojo, you are. Where discipline dies and dancers cry, this place is. Much pain, you will feel. Much suffering, yes yes."
    > "Only one of you, out climbs. The other, stays behind they will. Awkward you may feel, but awkward you must not make. Focus, you must. Or fail like the weaklings, you will."

*   **UI Explanation**:
    > "Damage percent? Higher the number, faster your flight time becomes. Physics, hates you it does. Punish you, it will. Especially if girl you are, hmm."
    > "Hearts? Your lives, they are. Lose them, and set dressing you become. Pretty you may look, but dead you will be. Useless, the dead are."

*   **Ultimate Explanation**:
    > "Full, your Ultimate is! Dangerous in very irresponsible way, you have become. Proud, I should be. Worried, I am instead. Much damage, you will cause. Much regret, you will feel. Or not feel, if heartless you are, hmm."
    > "R3, hit you must. Problems for everyone, cause it will. Yourself included, yes yes. Control it, you think you can. Wrong, you are. Always wrong, you are. But try, you must. Or else useless, you remain."

*   **Beat Charge Explanation**:
    > "A special move, there is. The Grab, it is called. Powerful, it is. Dangerous, it also is. Like a hug from a bear, it is. Warm, it is not. Painful, it is. Much pain, yes yes."
    > "An opponent who hoards Ulti-Charges and Beat-Charges, if you grab them, steal all their Ultimate power you will. Greedy, they were. Punished, they will be. Justice, this is. Or cruelty. Same thing, they often are, hmm."


## Part 3: Advanced Rhythm Tutorial

This part introduces the more advanced mechanics related to rhythm and the "Dance Spot".

### Introduction

*   **Objective**: Understand the advanced rhythm mechanics.
*   **Instructions**: The tutorial begins with a modal explaining the core concepts:
    > "When the music starts, legally your body must move in rhythm. No choice, you have. Compelled, you are. Like a puppet, you become. But powerful puppet, you can be, yes yes."
    > "At the top of screen, two UI bars collide they do. The perfect beatmatch moment, show you they will. Watch them, you must. Stare at them, you should. Obsess over them, you might. Normal, this is not. Necessary, it is, hmm."

### Further Steps

The tutorial continues with more detailed explanations of the systems:

*   **Beat Charges**:
    > "On a powered hit, burn those Beat Charges you must. Bones rattle, make them you will. Satisfaction, you will feel. Or guilt. Both, perhaps. But do it anyway, yes yes. Powerful, it makes you feel. Good or bad, matters not. Power, it is what matters."

*   **The Dance Spot**:
    > "In the eye of Dance Spot, stand you must. Where power doubles, that place is. Powerful, you will feel. Invincible, you might think. Wrong, you will be. But powerful anyway, yes yes."
    > "2× Ultimate. 2× Beat Charges. Generous chaos-storm, this is. Destructive, it becomes. Beautiful, it also is. Like a storm, yes yes. Beautiful and deadly. Like a woman, some say. Offensive, that might be. True, it might also be, hmm."

*   **Attack Variations**: The tutorial explains the different basic attacks (R1, R2, L1, L2) and how they vary between characters.

*   **Music Fading**:
    > "To a dying-toaster whisper, if the music fades, and ghostly your UI starts looking, to a quarter your bonuses drop. Which compounds over time, to significant loss in dance_assets it becomes..."
