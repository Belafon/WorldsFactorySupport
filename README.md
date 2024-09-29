# WorldsFactorySupport 

This is a support tool for story creation in WorldsFactory software. 
User can create or remove a Character, SideCharacter, Location, Event and Passage.

## Commands:

- 'WF: Create Character'
- 'WF: Remove Character'
- 'WF: Create SideCharacter'
- 'WF: Remove SideCharacter'
- 'WF: Create Location'
- 'WF: Remove Location'
- 'WF: Create Event'
- 'WF: Remove Event'
- 'WF: Create Passage'
- 'WF: Remove Passage'
- 'WF: Create Event With Outline' ~ Shows a form to create new event

## Completion:

### Passage editing

#### For main character of the passage

- When typing `'character'` or `'{character id}'`, completion will show and after selecting, `s.characters.{character id}` will be inserted. 

#### For objects of world state

- When an object of world state is used already, when starting to type the object name, completion will show and after selecting, `s.{object type}.{object id}.{modifier}.` will be inserted.