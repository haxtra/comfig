# Comfig

Human-friendly, customizable, file-based config reader/writer with first-class comment support. The convenience of a plain text file, with the joy of programmatic access.

## Features

- supports strings, multi-line strings, numbers, booleans, objects and arrays*
- freestyle comments, anything that is not data is a comment, choose your style
- sections, comments and data can be created/updated/reordered/deleted programmatically
- preserves original layout when saving, comments included
- native performance of a plain JS object
- customizable indent and assign operator
- sync or async file operation
- single file, no dependencies


## Limitations

- no variables, functions or computed properties
- objects and arrays one level deep only
- object keys and array elements cannot have comments
- keys cannot use `.` (dot) in their name


## Example File

```
▄▀▀ ▄▀▄ █▄ █ █▀▀ ▀█▀ ▄▀▀
▀▄▄ ▀▄▀ █ ▀█ █▀  ▄█▄ ▀▄█

    🔥 I said freestyle, and I mean it! 🔥

■ This is so-called "section"
■ Comments can span multiple lines
■ Here we have strings:
single: hello there!
multi: """
    whitespace is

 preserved
"""

★ Assignment symbol is configurable
★ Can be ":" or "=" with any padding
★ But I can read any valid Comfig file
★ Check out these numbers:
intie = 42
floatie = 3.14

♥ Default comment style is also configurable
♥ Although it only affects new comments
♥ But I have tools to convert style anytime
♥ Bools, here we come:
truly: true
falsy: false
nully: null

║ Yes, the null is not bool
║ I just want to tell you that you can use...
║ snake_case or kebab-case in your key names
snake_case: true
kebab-case: true
m-iX3_d: true

► Indentation is configurable too
► It affects objects and arrays
► Speaking of which:
obby: {
    default: tab
    spaces: true
}

[
[ And finally the array
[
arry: [
    neat
    really
]
```

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Options](#options)
- [Object](#object)
- [Instance](#instance)
    - [Data](#-data)
        - [Set](#set)
        - [Get](#get)
        - [hasKey](#haskey)
        - [getRelated](#getrelated)
        - [getKeys](#getkeys)
        - [Delete](#delete)
    - [Comments](#-comments)
        - [Get comment](#get-comment)
        - [Set comment](#set-comment)
        - [Delete comment](#delete-comment)
        - [Convert symbol](#convert-symbol)
    - [Sections](#-sections)
        - [Add section key](#add-section-key)
        - [Create section](#create-section)
        - [Move section](#move-section)
        - [Reorder section](#reorder-section)
    - [State](#-state)
        - [Clear](#clear)
        - [Save](#save)
        - [Load](#load)
        - [Import](#import)
        - [Sync](#sync)
        - [Upgrade](#upgrade)
        - [Serialize](#serialize)
        - [Config object](#config-object)
    - [Misc](#-misc)
        - [Update file path](#update-file-path)
- [Exceptions](#exceptions)
- [Note](#note)
- [License](#license)


## Install

    npm i comfig


## Usage

Comfig has two forms: an object, and a class instance. The object is the recommended way for regular operation, reading and updating existing values. Being a plain JavaScript object, is simple to use and offers great performance, but there is no control over the layout. The instance is more elaborate, but allows full control over sections, comments and data.

You can switch between the two at any time by calling `.$()` on either of them.

> Note: Both forms use their own state, so don't update stuff in parallel.


## Options

Comfig can read any valid Comfig file, no matter if it uses `:` or `=` for mapping, tabs or spaces. These options only affect serialization, ie what the file will look like after saving.

`pathToFile` is optional, you can use other means to populate the state, see [State](#-state) section.

```js
const config = require('comfig')(pathToFile?, {
    // showing defaults
    comment: '■', // comment symbol, affects new comments only
    assign: ': ', // assignment symbol, affects serialization
    indent: '\t', // indentation symbol, affects serialization
    fileMustExist: false // throws error if file does not exist
})
```

## Object

The object form is just a plain JavaScript object with few methods attached for saving, syncing, and getting the instance.

```js
const config = require('comfig')(pathToFile?, opts?)

// make changes, create, update
config.foo = 'bar'

// or delete
delete config.baz

// save changes to disk, either
config.$saveSync()    // sync
await config.$save()  // async

// save to another file, maybe
await config.$save('path/to/another/file')

// or just sync back to the instance
config.$sync()

// get comfig instance
const comfig = config.$()

```

## Instance

Instance recognizes the file structure, consisting of sections separated by a blank line. A section is a block composed of a comment followed by key-value pairs, a single entry or a group. Both are optional, so there can be a section made of a lone comment, or data without a comment.

```js
// create Comfig instance
const Comfig = require('comfig').Comfig
const comfig = new Comfig(pathToFile?, opts?)
```

### ★ Data

Some functions that can also manipulate object keys and array elements (such as `.set` below), accept *dotpath* notation style param, like `key.subkey`. Later this guide will reference them as `dotKey` param, in opposition to `key` which only allows top level key name.

#### Set

Update existing values, or create new keys. `.set` returns section id or error object if anything goes wrong. Mind that objects/arrays can only hold primitive types and single line strings.

To update existing key:

```js
comfig.set('key', value)        // top level key
comfig.set('key.subkey', value) // object property
comfig.set('key.0', value)      // array element
```

`.set` also can be used to create new keys, but these keys will be appended at the end, along with a new section for each. To insert new keys at arbitrary position, use `.addSection` or `.addSectionKey` methods, see [Sections](#-sections).

Creating new keys must be explicitly allowed, otherwise error is returned:

```js
comfig.set('newKey', value, {create:true})

// create new key with a comment
comfig.set('newKey', value, {create:true, comment:myComment})
```

#### Get

Get key's value, or `undefined` if no default is given.

```js
comfig.get(dotKey, default?)
```

#### hasKey

Returns bool if key exists.

```js
comfig.hasKey(dotKey)
```

#### getRelated

Returns key-value object of related keys - belonging to the same section.

```js
comfig.getRelated(key)
````

#### getKeys

Returns array of all top level keys currently in use.

```js
comfig.getKeys()
````

#### Delete

Remove given key or array element.

```js
comfig.delete(dotKey)
```

Removal of the last key from section, will not remove the section if it has a comment. To do so, pass `true` as second parameter:

```js
comfig.delete(key, true)
```

### ★ Comments

#### Get comment

Get comments for given key or section id, as an array of lines, with the comment symbols removed.

```js
comfig.getComment(key|id, raw?)
// ['first line', 'second line']
```

To get comment as a raw string, pass `true` as second parameter:

```js
comfig.getComment(key|id, true)
// '■ first line\n■ second line\n'
```

Explicit methods are also provided:

```js
comfig.getKeyComment(key, raw?)
comfig.getSectionComment(id, raw?)
```

#### Set comment

Set section comment, by key or section id. Accepts string, single or multiline, or array of lines. The comment will be formatted automatically, with each line prefixed with configured comment symbol.

To set/replace comment with a new one:

```js
comfig.setComment(key|id, comment:str|arr)
```

To add to existing comment use `add` option:

```js
comfig.setComment(key|id, comment, {add:true})
```

To skip autoformatting and insert custom style comment, use `raw` option. Raw comment must be a string, and must end with `\n`.

```js
comfig.setComment(key|id, comment:str, {raw:true})
```

Explicit methods are provided:

```js
comfig.setKeyComment(key, comment, opts?)
comfig.setSectionComment(id, comment, opts?)
```

#### Delete comment

Remove section comment for given key or section id.

```js
comfig.deleteComment(key|id)
```

Explicitly:

```js
comfig.deleteKeyComment(key)
comfig.deleteSectionComment(id)
```

#### Convert symbol

New comments are prefixed with configured symbol. Should you change your mind later, you can convert comments to a new style easily.

```js
comfig.convertCommentSymbol(oldSymbol, newSymbol)
// single symbol
comfig.convertCommentSymbol('■', '♥')
// in bulk
comfig.convertCommentSymbol(['»','★','►'], '♥')
````


### ★ Sections

Sections are referenced by an id, which corresponds to their position in the array that holds sections. This means the id is ephemeral and will change when you manipulate the array, ie create/move/delete sections.

Section ids are retrieved by a key name that belongs to that section:

```js
const id = comfig.getSectionId(key) // int
```

#### Add section key

Add new key to existing section.

```js
comfig.addSectionKey(id, key, value)
```

#### Create section

New sections can be inserted at arbitrary position. It can contain only a key-value pair, only a comment, or both, of course. If `id` is given, new section will be inserted at that position, and section currently occupying that space will shift down. When `id` is omitted, new section will be appended at the end.

```js
const newId = comfig.addSection( {id, key, value, comment} )
```

Optionally more items can be added, using newly obtained id:

```js
comfig.addSectionKey(newId, key, value)
```

#### Move section

Order of sections can be reorganized freely. Like with `.addSection`, section at `targetId` will shift one notch down.

```js
comfig.moveSection(id, targetId)
```

#### Reorder section

Section contents, the key-value pairs, can also be reorganized. The array param must contain all key names belonging to that section.

There is no method to reorder object and arrays elements, because that's easy to do in the code, just set new value with desired order.

```js
comfig.reorderSection(id, newOrderArray)
// like so:
comfig.reorderSection(3, ['bar','baz','foo'])
```

### ★ State

#### Clear

Reset state to a blank slate. File on disk will not change until you save.

```js
comfig.clear()
```

#### Save

Save current state to a file the instance was created with. When path is given as a parameter, it will save to that file instead, just this one time. To permanently change path to the file, use `.useFile` method.

> Note: `.save` will throw an error if structure is invalid, for example when you use deep objects.

```js
comfig.save(path?)     // async
comfig.saveSync(path?) // sync
```

#### Load

Load state from a Comfig file.

```js
comfig.loadSync(filePath)
```

#### Import

Replace state with the state from Comfig text.

```js
comfig.import(comfigText)
```

#### Sync

Comfig instance can be updated in bulk with values provided in an object. There are three modes:
- update - update key values only, does not create new keys
- merge  - update key values and create new keys as needed
- mirror - update values, create new keys, and remove keys not found in the object, possibly along with their section (same behavior as `.delete`)

Mode must be explicitly set, there is no default.

```js
comfig.sync(obj, {update:true}) // update
comfig.sync(obj, {merge:true})  // update + create
comfig.sync(obj, {mirror:true}) // update + create + delete
```

#### Upgrade

`.upgrade` allows easy in-place upgrade to a new config version, forcing new layout while preserving current values. Underneath it uses `.sync` in `update` mode on a new instance. The function accepts path to new file version, or Comfig instance.

Note that top-level keys will be synced as a whole, including entire contents of objects and arrays.

File on disk won't change until you save.

```js
comfig.upgrade(filePath|newComfigInstance)
```

#### Serialize

`.serialize` transforms current state to beautiful Comfig text format. When is valid, because otherwise it will throw an error.

```js
const text = comfig.serialize()
```

#### Config object

`.object`, aliased to `.$`, returns instance state as a plain object.

```js
// equivalent
config = comfig.$()
config = comfig.object()
```

### ★ Misc

#### Update file path

`.useFile` is used to change file path midway through.

```js
comfig.useFile(newFilePath)
```

## Exceptions

Comfig throws exceptions under these conditions:
- creating an instance with invalid option formats, ie `assign` and `indent`
- when file does not exist and `fileMustExist` option is used
- when trying to save with invalid state, ie having deep objects or multiline strings in objects/arrays
- file IO errors coming from the system


## Note

Regarding the object depth limit, I wrote this library for my own need, where support for deep objects was not required, so I took the easy route. I still don't have that need, so it is what it is for the time being. If the need arises, or this library somehow becomes popular, I may consider v2 and take it to the next level.


## License

MIT

![](https://hello.haxtra.com/gh-comfig)