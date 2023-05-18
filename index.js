"use strict"

const fs = require('fs')


// MAIN >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

class Comfig {

	constructor(filePath, opts={}) {

		this.file = filePath

		this.opts = Object.assign({
			comment: '■',	// comment style for new comments
			assign: ': ',	// assign operator
			indent: '\t',	// indentation char
			fileMustExist: false,  // throw an error if file does not exist
		}, opts)

		// reset state
		this.clear()

		if(!/^\s*[:=]\s*$/.test(this.opts.assign))
			throw new Error('Comfig: invalid .assign opt, use `:` or `=`')

		if(!/^[ \t]+$$/.test(this.opts.indent))
			throw new Error('Comfig: invalid .indent opt, use tabs or spaces')

		if(filePath)
			this.loadSync()
	}

	// IO

	loadSync(filePath) {
		/** Load and parse comfig file
			  @return   (bool) true on success, false if file does not exist
			  @throws   when .fileMustExist flag is on, and the file is missing,
			            or another IO error occured
		**/

		try {
			const text = fs.readFileSync(filePath || this.file, 'utf8')
			this.import(text)
			return true
		} catch (err) {
			// throw if file is missing in strict mode, or there is another problem
			if((err.code == 'ENOENT' && this.opts.fileMustExist) || err.code != 'ENOENT')
				throw err
			return false
		}
	}

	async save(filePath) {
		/** Serialize and save comfig file, asynchronously **/

		const text = this.serialize()
		await fs.promises.writeFile(filePath || this.file, text, 'utf8')
	}

	saveSync(filePath) {
		/** Serialize and save comfig file, synchronously **/

		const text = this.serialize()
		fs.writeFileSync(filePath || this.file, text, 'utf8')
	}

	clear() {
		/** Reset state **/
		this.tree = []
		this.index = {}
	}

	import(comfigText) {
		/** Replace current state with state from parsed text **/
		const parser = new ComfigParser(comfigText)
		this.tree = parser.tree
		this.index = parser.index
	}

	serialize() {
		/** Serialize current state.
			Will throw if structure is invalid.
		**/

		const serial = new ComfigSerializer(this.tree, this.opts)
		return serial.text
	}

	useFile(filePath) {
		/** Use new file **/
		this.file = filePath
	}

	// Object form

	$() {
		/** Get config object.
			Alias to mirror switch method with the object form.
		**/

		return this.object()
	}

	object() {
		/** Get config as a plain object, armed with save methods **/

		const instance = this

		const conf = {
			$: function(){
				instance.sync(this, {mirror:true})
				return instance
			},
			$save: async function(filePath) {
				instance.sync(this, {mirror:true})
				await instance.save(filePath)
			},
			$saveSync: function(filePath) {
				instance.sync(this, {mirror:true})
				instance.saveSync(filePath)
			},
			$sync: function() {
				instance.sync(this, {mirror:true})
			},
		}

		// extract data keys
		const obj = {}
		for(const entry of this.tree)
			Object.assign(obj, entry.data)

		return Object.assign(conf, obj)
	}

	// Getters & Setters

	get(dotKey, dflt){
		/** Get option value
			  :dotKey   (str) dotkey access path
			  :dflt     (any) default value
			  @return   default or undefined
		**/

		const [key, subkey] = dotKey.split('.')

		const idx = this.index[key]

		if(idx === undefined)
			// key not set
			return dflt
		else if(subkey)
			// obejct or array item
			return this.tree[idx].data[key][subkey] !== undefined
					? this.tree[idx].data[key][subkey]
					: dflt
		else
			// direct value
			return this.tree[idx].data[key]
	}

	getKeys() {
		/** Get an array of all top level keys in use **/

		let keys = []
		for(const entry of this.tree)
			keys = keys.concat(Object.keys(entry.data))

		return keys
	}

	getRelated(key) {
		/** Get all keys belonging to the same section, as an object
			  @return    (obj) data or error
		**/

		const idx = this.index[key]

		if(idx === undefined)
			return {error: 'config option does not exist'}

		return this.tree[idx].data
	}

	set(dotKey, value, opts={}) {
		/** Set value for existing key, or create a new one.
			Newly created items will be appended at the end within own section.
			  :dotKey     (str) key access path
			  :value      (any) value to set
			  :opts
			   .create?   (bool) allow new key creation, will error otherwise {false}
			   .comment?  (str) section comment, if creating new top level key (optional)
			  @return     (int|obj) section id or error object
		**/

		const [key, subkey] = dotKey.split('.')

		const idx = this.index[key]

		// insert for new options
		if(idx === undefined){

			// creation of new keys must be explictly allowed
			if(!opts.create)
				return {error: 'config option does not exist'}

			let data;
			if(subkey) {
				const invalidSubkey = this._validateSubkeyValue(value)
				if(invalidSubkey)
					return invalidSubkey
				data = { [key]: {[subkey]: value} }
				value = data[key]
			} else {
				data = { [key]: value }
			}
			this.tree.push({comment: this._formatComment(opts.comment), data})
			this.index[key] = this.tree.length - 1
			return this.index[key]
		}

		// update existing option
		if(subkey){
			const invalidSubkey = this._validateSubkeyValue(value)
			if(invalidSubkey)
				return invalidSubkey
			this.tree[idx].data[key][subkey] = value
		} else {
			this.tree[idx].data[key] = value
		}
		return idx
	}

	delete(dotKey, removeComment) {
		/** Remove option key.
			Will remove empty section, unless it has a comment.
			  :removeComment   (bool) remove empty, even with a comment
		**/

		const [key, subkey] = dotKey.split('.')

		const idx = this.index[key]

		if(idx === undefined)
			return false

		if(subkey){
			// delete sub item

			const item = this.tree[idx].data[key]

			if(Array.isArray(item))
				// array
				item.splice(subkey, 1)
			else if(typeof item == 'object' && item != null)
				// object
				delete item[subkey]
			else
				return {error: 'not an object/array'}

			return true
		}

		// delete top-level key
		delete this.tree[idx].data[key]
		delete this.index[key]

		// check if section qualifies for removal
		if(Object.keys(this.tree[idx].data).length > 0)
			// section has other keys
			return true
		else if(this.tree[idx].comment && !removeComment)
			// section has only comment left, but we don't want to delete it
			return true

		// purge section
		this.tree.splice(idx, 1)

		// rebuild index
		this._rebuildIndex()

		return true
	}

	hasKey(dotKey) {
		/** Check if key exists **/
		return !!this.get(dotKey)
	}

	getSectionId(key) {
		/** Get id of the section to which the key belongs to **/
		return this.index[key]
	}

	_validateSubkeyValue(value) {
		/** Ensure that object values are a primitive **/

		if((typeof value == 'object' && value != null)
		|| (Array.isArray(value))
		|| (typeof value == 'string' && value.includes('\n')) )
			return {error: 'invalid object value, deep objects, arrays and multiline strings are not allowed'}
	}

	// Comments

	setComment(entityId, comment, opts={}) {
		/** Add or replace comment for section containing given key
			  :idx     (int) section id
			  :comment (str) comment body
			  :opts
			   .add?   (bool) add to existing comment, otherwise replace {false}
			   .raw?   (bool) don't format, use as provided {false}
		**/

		if(Number.isInteger(entityId))
			return this.setSectionComment(entityId, comment, opts)
		else if(typeof entityId == 'string')
			return this.setKeyComment(entityId, comment, opts)
		else
			return {error: 'invalid entity id, must be key name or section id'}
	}

	setKeyComment(key, comment, opts) {

		const idx = this.index[key]

		if(idx === undefined)
			return {error: 'config option does not exist'}
		else
			return this._setComment(idx, comment, opts)
	}

	setSectionComment(idx, comment, opts={}) {

		if(this.tree[idx] === undefined)
			return {error: 'invalid section id'}
		else
			return this._setComment(idx, comment, opts)
	}

	_setComment(idx, comment, opts={}){
		/** Set comment, see .setComment for more info **/

		if(opts.raw){
			// comments must end with \n
			if(!comment.endsWith('\n'))
				comment += '\n'
		} else {
			comment = this._formatComment(comment)
		}

		if(opts.add)
			this.tree[idx].comment += comment
		else
			this.tree[idx].comment = comment
	}

	_formatComment(comment) {
		/** Prepend each comment line with configured comment chars
			  :comment  (str|arr) comment to format
			  @return   (str)
		**/

		if(!comment)
			return ''

		if(typeof comment == 'string'){
			comment = comment.split('\n')

		return comment
				.map(line => `${this.opts.comment} ${line}`)
				.join('\n') + '\n'
		}
	}

	getComment(entityId, raw) {
		/** Get comment for an entity, key or section
			Note: comments begin with symbols.
		**/

		if(Number.isInteger(entityId))
			return this.getSectionComment(entityId, raw)
		else if(typeof entityId == 'string')
			return this.getKeyComment(entityId, raw)
		else
			return {error: 'invalid entity id, must be key name or section id'}
	}

	getKeyComment(key, raw) {

		const idx = this.index[key]

		if(idx === undefined)
			return {error: 'config option does not exist'}

		const comment = this.tree[idx].comment
		return raw ? comment : this._getComment__strip(comment)
	}

	getSectionComment(idx, raw) {

		const section = this.tree[idx]

		return section
			? (raw ? section.comment : this._getComment__strip(section.comment))
			: {error: 'invalid section id'}
	}

	_getComment__strip(str) {
		/** Strip comment symbols and return array of clean text lines **/

		const clean = []
		const lines = str.split('\n')
		const regex = /^[^\p{L}\p{N}]+\s*(.+)/u

		for(const line of lines){
			const res = regex.exec(line)
			if(res)
				clean.push(res[1])
		}

		return clean
	}

	deleteComment(entityId) {
		/** Delete entity comment, key or section **/
		return this.setComment(entityId, null)
	}

	convertCommentSymbol(fromChars, toChar){
		/** Convert comment symbol from one to another.
			Only converts first character of the line.
			  :fromChars   (str|arr) symbols to replace
			  :toChar?     (str) symbol to convert to, defaults to current config
		**/

		if(!toChar)
			toChar = this.opts.comment

		for(const idx in this.tree){
			const entry = this.tree[idx]

			if(!entry.comment)
				continue;

			const lines = entry.comment.split('\n')

			for(const i in lines){
				for(const char of fromChars){
					if(lines[i][0] == char){
						// replace
						lines[i] = toChar + lines[i].substr(1)
					}
				}
			}

			this.tree[idx].comment = lines.join('\n')
		}
	}

	// Sections

	addSectionKey(idx, key, value) {
		/** Add new key to existing section **/

		if(!this.tree[idx])
			return {error: 'invalid section id'}

		if(this.index[key])
			return {error: 'key already exist'}

		this.tree[idx].data[key] = value
		this.index[key] = idx
	}

	addSection(opts) {
		/** Insert new section at arbitrary position.
			  :opts
			   .id?       (int) section id to insert at, will append if omitted
			   .key?      (str) initial option name, must be unique
			   .value?    (multi) option value
			   .comment?  (str) section comment
			  @return     (int|obj) section id or error object
		**/

		if(!('id' in opts) && !('key' in opts) && !('value' in opts) && !('comment' in opts))
			return {error: 'no params supplied'}

		let data;

		if((opts.key || 'value' in opts) && (!opts.key || !('value' in opts))){
			// this block runs when key or value are provided, but not both
			return {error: 'when setting key, both key and value are required'}
		} else if(opts.key) {
			// key and value are provided

			if(this.index[opts.key] !== undefined)
				return {error: 'key already exist'}

			data = { [opts.key]: opts.value }
		}

		const section = {
			comment: this._formatComment(opts.comment),
			data: data || {}
		}

		if('id' in opts){
			// insert somewhere in the middle

			if(!data && !opts.comment)
				return {error: 'no data'}

			if(!this.tree[opts.id])
				return {error: 'invalid section id'}

			this.tree.splice(opts.id, 0, section)

		} else {
			// append
			this.tree.push(section)
		}

		this._rebuildIndex()

		return 'id' in opts ? opts.id : this.tree.length - 1
	}

	moveSection(idxFrom, idxTo) {
		/** Rearrange sections **/

		if(!this.tree[idxFrom] || !this.tree[idxTo])
			return {error: 'invalid section id'}

		const section = this.tree.splice(idxFrom, 1)

		if(idxFrom < idxTo)
			idxTo -= 1

		this.tree.splice(idxTo, 0, section[0])

		this._rebuildIndex()
	}

	reorderSection(idx, newOrder) {
		/** Reorder section items to match provided array **/

		if(!this.tree[idx])
			return {error: 'invalid section id'}

		const item = this.tree[idx].data

		if(!this._commonArrays(Object.keys(item), newOrder))
			return {error: 'invalid new order array'}

		const data = {}
		for(const key of newOrder)
			data[key] = this.tree[idx].data[key]

		this.tree[idx].data = data
	}

	deleteSection(idx) {

		if(!this.tree[idx])
			return {error: 'invalid section id'}

		this.tree.splice(idx, 1)

		this._rebuildIndex()
	}

	_commonArrays(arr1, arr2) {
		/** Check if both arrays include same items, no matter the order **/
		return arr1.filter(item => arr2.includes(item)).length === arr2.length
	}

	// Misc

	upgrade(param) {
		/** Upgrade current instance to a new layout.
			Does not save automatically.
			  :param  (str|Comfig) file path or Comfig instance
		**/

		let newComfig;

		if(typeof param == 'string'){
			// path to file
			newComfig = new Comfig(param)
		} else if(typeof param == 'object' && param.constructor.name == 'Comfig') {
			// Comfig instance
			newComfig = param
		}

		newComfig.sync(this.object(), {update:true})

		// swap local state
		this.tree = newComfig.tree

		this._rebuildIndex()
	}

	sync(obj, opts={}) {
		/** Update local state with obj values.
			Mode must be given, there is no default.
			  :obj       (obj) object to update from
			  :opts
			   .update?  (bool) overwrite values of keys present in local
			   .merge?   (bool) overwrite values, add new keys
			   .mirror?  (bool) overwrite values, add new keys, remove local if not exist in object
			                    mirror will also delete sections
		**/

		if(typeof obj !== 'object' || obj === null)
			return {error: 'sync requires an object'}

		const objKeys = Object.keys(obj).filter( key => key[0] != '$')

		if(opts.update){
			// only update key values present in local state

			for(const key in obj){
				const idx = this.index[key]
				if(idx !== undefined){
					this.tree[idx].data[key] = obj[key]
				}
			}

		} else if(opts.merge) {
			// update key values, add new keys

			this._sync__merge(objKeys, obj)

		} else if(opts.mirror) {
			// update values, add new keys, remove not present in object

			this._sync__merge(objKeys, obj)

			for(const localKey of this.getKeys()){
				if(!objKeys.includes(localKey))
					// not present in local, remove
					// .delete rebuilds index automatically
					this.delete(localKey, true)
			}

		} else {
			return {error: 'sync mode not specified'}
		}

		this._rebuildIndex()
	}

	_sync__merge(mergeKeys, obj) {

		for(const key of mergeKeys){
			const idx = this.index[key]
			if(idx !== undefined){
				// update
				this.tree[idx].data[key] = obj[key]
			} else {
				// add
				this.tree.push({comment: '', data:{
					[key]: obj[key]
				}})
			}
		}
	}

	_rebuildIndex() {
		/** Rebuild index after manipulating the tree **/

		this.index = {}

		for(let idx=0; idx<this.tree.length; idx++){
			for(const key in this.tree[idx].data)
				this.index[key] = idx
		}
	}
}


// PARSER >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

class ComfigParser {

	constructor(text) {

		// input
		this.text = text.replace('\r', '')

		// state
		this.section = null
		this.sectionId = -1

		// result
		this.tree = []
		this.object = {}
		this.index = {}

		// fire away
		this.parse()
	}

	parse() {

		const regex = {
			multistring: /^([\w_-]+)\s*[:=]\s* """/,
			array:       /^([\w_-]+)\s*[:=]\s*\[/,
			object:      /^([\w_-]+)\s*[:=]\s*{/,
			objectBody:  /^\s+([\w_-]+)\s*[:=]\s*(.*)/,
			option:      /^([\w_-]+)\s*[:=]\s*(.*)/,
		}

		this.resetSection()

		const lines = this.text.split('\n')

		let r, key, buffer, last;

		for(const line of lines){

			const lean = line.trim()

			// blank line
			if(lean == ''){

				if(last == 'multistring'){
					// part of multistring
					buffer.push(line)

				} else {
					// gap between blocks
					if(last != 'blank')
						this.flush()

					last = 'blank'
				}
			}

			// multistring
			else if(r = regex.multistring.exec(line)){
				key = r[1]
				last = 'multistring'
				buffer = []

			}
			else if(last == 'multistring'){

				if(lean != '"""') {
					// body
					buffer.push(line)

				} else if(lean == '"""'){
					// closing
					this.addKey(key, buffer.join('\n'))
					last = null
				}

			}

			// array
			else if(r = regex.array.exec(line)){
				key = r[1]
				buffer = []
				last = 'array'

			} else if(last == 'array'){

				if(lean != ']'){
					// array, data
					buffer.push(this.convertValue(line))

				} else if(lean == ']'){
					// array, close
					this.addKey(key, buffer)
					last = null
				}

			}

			// object
			else if(r = regex.object.exec(line)){
				key = r[1]
				buffer = {}
				last = 'object'

			} else if(last == 'object'){

				if(lean != '}'){
					// object, body
					r = regex.objectBody.exec(line)
					buffer[ r[1] ] = this.convertValue(r[2])

				} else if(lean == '}'){
					// object, close
					this.addKey(key, buffer)
					last = null
				}

			}

			// primitives, single line
			else if(r = regex.option.exec(line)){

				const key = r[1]
				const val = this.convertValue(r[2])
				this.addKey(key, val)
				last = null

			}

			// comment
			else {
				this.addComment(line)
				last = null
			}
		}

		this.flush()
	}

	resetSection() {

		this.sectionId ++

		this.section = {
			comment: '',
			data: {},
		}
	}

	flush(){
		/** Add current section to the tree **/

		// skip if current section is blank, so we don't create series of blank lines
		if(this.section.comment == '' && Object.keys(this.section.data).length == 0)
			return;

		// flush whatever there is
		this.tree.push(this.section)
		this.resetSection()
	}

	addComment(comment) {
		this.section.comment += comment + '\n'
	}

	addKey(key, value) {
		this.section.data[key] = value
		this.object[key] = value
		this.index[key] = this.sectionId
	}

	convertValue(val) {

		val = val.trim()

		if(/^\d+$/.test(val))
			return parseInt(val)
		else if(/^\d+\.\d+$/.test(val))
			return parseFloat(val)
		else if('true' == val)
			return true
		else if('false' == val)
			return false
		else if('null' == val || 'undefined' == val || '' == val)
			return null
		else
			return val
	}
}


// SERIALIZER >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

class ComfigSerializer {

	constructor(tree, opts={}) {

		this.tree = tree
		this.text = null

		this.opts = Object.assign({
			assign: ': ',
			indent: '\t',
		}, opts)

		this.serialize()
	}

	serialize() {

		const {assign, indent} = this.opts

		const lines = []
		for(const section of this.tree){

			if(section.comment)
				lines.push(section.comment)

			for(const key in section.data){

				if(Array.isArray(section.data[key])){
					// array
					const body = []
					const elems = section.data[key].map(val => indent + val).join('\n')
					for(const value of section.data[key]) {
						this.throwOnInvalidSubkey(value)
						body.push(`${indent}${value}`)
					}
					lines.push(`${key}${assign}[\n${body.join('\n')}\n]\n`)

				} else if(typeof section.data[key] == 'object' && section.data[key] != null) {
					// object
					const body = []
					for(const skey in section.data[key]){
						this.throwOnInvalidSubkey(section.data[key][skey])
						body.push(`${indent}${skey}${assign}${section.data[key][skey]}`)
					}

					lines.push(`${key}${assign}{\n${body.join('\n')}\n}\n`)

				} else if(typeof section.data[key] == 'string' && section.data[key].indexOf('\n') > -1) {
					// multiline string
					lines.push(`${key}${assign}"""\n${section.data[key]}\n"""\n`)

				} else {
					// primitives, single line
					let val = section.data[key]
					if(val === undefined) val = null
					lines.push(`${key}${assign}${val}\n`)
				}
			}

			// delimit section
			lines.push('\n')
		}

		// remove last elem, it's a newline
		while(lines[ lines.length - 1 ] == '\n')
			lines.pop()

		this.text = lines.join('')

		return this.text
	}

	throwOnInvalidSubkey(data) {
		if( (typeof data == 'object' && data != null)
		|| (Array.isArray(data))
		|| (typeof data == 'string' && data.includes('\n')) ) {
			throw new Error('Comfig: invalid object value, deep objects, arrays and multiline strings are not allowed')
		}
	}
}


// EXPORTS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

module.exports = function(filePath, opts){
	return new Comfig(filePath, opts).object()
}
module.exports.Comfig = Comfig
module.exports.Parser = ComfigParser
module.exports.Serializer = ComfigSerializer
