const assert = require('assert')
const Equal = assert.strictEqual
const Truthy = result => Equal(!!result, true)
const ErrObj = result => Equal(!!result.error, true)
const Throws = assert.throws
const debug = obj => console.log(require('node:util').inspect(obj, {depth:null, colors:true, compact:false, numericSeparator:true}))
const die = obj => {debug(obj); process.exit()}
const die2 = (obj1, obj2) => {debug(obj1); debug(obj2); process.exit()}

let tests = 0
let indent = 0

function section(title, fn){
	console.log(`${' '.repeat(indent)}${title}`)
	indent += 2
	fn()
	indent -= 2
}

function test(title, fn){
	tests += 1
	console.log(`${' '.repeat(indent)}${tests}) \x1b[2m${title}\x1b[0m`)
	fn()
}



const Comfig = require('./index.js')
const file = './~testfile.config'

let Comf, conf;

//
// 	Init
//

const start = Date.now()

test('throw on bad opts', function(){

	// assign must be : or =
	Throws(() => {
		conf = Comfig(null, {
			assign: 'x',
		})
	})

	// indent must be a whitespace
	Throws(() => {
		conf = Comfig(null, {
			indent: 'x',
		})
	})
})

test('create blank instance', function(){
	// create blank
	conf = Comfig(null, {
		assign: ' = ',
		indent: '  ',
		comment: '@',
	})
})


test('morph to comfig instance', function(){
	conf.key1 = 'val1'
	Comf = conf.$()
	Equal(Comf.constructor.name == 'Comfig', true)
})

test('get var set on object', function(){
	Equal(Comf.get('key1'), 'val1')
})

test('.set returns error on create when not allowed', function(){
	ErrObj(Comf.set('key2', 'val2'))
})

test('.set create with create opt', function(){
	Equal(Comf.set('key2', 'val2', {create:true}), 1)
})

test('.set create with comment', function(){
	Equal(Comf.set('key3', 'val3', {create:true, comment:'key3'}), 2)
})


section('addSection', function(){

	// Error handling

	test('no empty opts', function(){
		ErrObj(Comf.addSection({}))
	})

	test('no lone id', function(){
		ErrObj(Comf.addSection({
			id: 0
		}))
	})

	test('require key and value', function(){
		ErrObj(Comf.addSection({
			id: 0,
			key: 'key1'
		}))
		ErrObj(Comf.addSection({
			id: 0,
			value: '!!!'
		}))
	})

	test('key must be unique', function(){
		ErrObj(Comf.addSection({
			key: 'key1',
			value: '!!!',
		}))
	})

	test('id must be valid', function(){
		ErrObj(Comf.addSection({
			id: 404,
			key: 'key',
			value: '!!!',
		}))
	})

	// Create

	test('comment only', function(){
		Truthy(Comf.addSection({
			comment: 'just comment, no data'
		}))
	})

	test('data only', function(){
		Truthy(Comf.addSection({
			key: 'key4',
			value: 'val4',
		}))
	})

	test('all opts', function(){
		Equal(Comf.addSection({
			id: 0,
			key: 'key0',
			value: 'val0',
		}), 0)
	})
})


section('data', function(){

	test('create all types', function(){
		Comf.set('key5', 'multi\n\nline', {create:true})
		Comf.set('key6', 123, {create:true})
		Comf.set('key7', 3.14, {create:true})
		Comf.set('key8', true, {create:true, comment: "i will be deleted"})
		Comf.set('key9', false, {create:true})
		Comf.set('key10', null, {create:true})
		Comf.set('key11', {aaa:111, bbb:'BBB', ccc:true}, {create:true})
		Comf.set('key12', [222,'CCC',false], {create:true})
	})

	test('addSectionKey', function(){
		Comf.addSectionKey(6, 'key55', 'single line')
		Comf.addSectionKey(6, 'key555', 'x')
	})

	test('get values', function(){

		// miss + default
		Equal(Comf.get('var404'), undefined)
		Equal(Comf.get('var404', '404'), '404')

		// read vars
		Equal(Comf.get('key1'), 'val1')
		Equal(Comf.get('key555'), 'x')
		Equal(Comf.get('key6'), 123)
		Equal(Comf.get('key7'), 3.14)
		Equal(Comf.get('key8'), true)
		Equal(Comf.get('key9'), false)
		Equal(Comf.get('key10'), null)
		Equal(Comf.get('key11.bbb'), 'BBB') // obj
		Equal(Comf.get('key12.1'), 'CCC') // arr
	})

	test('hasKey', function(){
		Equal(Comf.hasKey('key5'), true)
		Equal(Comf.hasKey('varx'), false)
	})

	test('getRelated', function(){
		const obj = Comf.getRelated('key5')
		Equal(obj.key5, 'multi\n\nline')
		Equal(obj.key55, 'single line')
		Equal(obj.key555, 'x')
		// process.exit(1)
	})

	test('delete', function(){

		// add
		Comf.set('del1', 'xxx', {create:true, comment:'delete me'})
		Comf.set('del2', 'yyy', {create:true, comment:'i will stay'})
		Comf.addSectionKey(15, 'del22', 'YYY')
		Comf.set('del3', {xxx:'XXX',yyy:'YYY'}, {create:true})

		// verify add
		Equal(Comf.get('del1'), 'xxx')
		Equal(Comf.get('del2'), 'yyy')
		Equal(Comf.get('del22'), 'YYY')
		Equal(Comf.get('del3.xxx'), 'XXX')
		Equal(Comf.get('del3.yyy'), 'YYY')

		// delete

		// delete with comment
		const id = Comf.getSectionId('del1')
		Equal(Comf.getComment('del1', true), Comf.getSectionComment(id, true))
		Comf.delete('del1', true) // del with comment
		ErrObj(Comf.getComment('del1'))
		Equal(Comf.getSectionComment(id, true), '@ i will stay\n')


		Comf.delete('del2')
		Comf.delete('del22')
		Comf.delete('del3.xxx')
		Comf.delete('del3.yyy')

		// verify delete
		Equal(Comf.get('del1'), undefined)
		Equal(Comf.get('del2'), undefined)
		Equal(Comf.get('del22'), undefined)
		Equal(Object.keys(Comf.get('del3')).length, 0)

		Comf.delete('del3')
		Equal(Comf.get('del3'), undefined)
	})

	test('subkey can be primitive only', function(){
		ErrObj(Comf.set('key11.ddd', {a:1}, {create:true})) // create
		ErrObj(Comf.set('key11.bbb', {a:1})) // update
	})

	test('serializer throws on deep objects', function(){
		c = Comfig('~willnotcreate.config')
		c.A = {B:{C:1}}
		Throws( () => c.$saveSync() )
	})
})


section('comments', function(){

	section('set comment', function(){

		const key = 'key1'
		const id = Comf.getSectionId(key)

		section('setComment', function(){

			const lockey = 'key555'

			test('replace (default)', function(){
				Comf.setComment(lockey, 'comment')
				Equal(Comf.getComment(lockey, true), '@ comment\n')
			})

			test('add', function(){
				Comf.setComment(lockey, 'comment2', {add:true})
				Equal(Comf.getComment(lockey, true), '@ comment\n@ comment2\n')
			})

			test('raw', function(){
				Comf.setComment(lockey, '% rawr', {raw:true})
				Equal(Comf.getComment(lockey, true), '% rawr\n')
			})
		})

		test('setKeyComment', function(){
			Comf.setKeyComment(key, 'com1')
			Equal(Comf.getComment(key, true), '@ com1\n')
		})

		test('setSectionComment', function(){
			Comf.setSectionComment(id, 'com2')
			Equal(Comf.getComment(key, true), '@ com2\n')
		})

		test('_setComment', function(){
			Comf._setComment(id, 'com3')
			Equal(Comf.getComment(key, true), '@ com3\n')
		})
	})

	section('get comment', function(){

		const comment = '% rawr\n'
		const key = 'key555'
		const id = Comf.getSectionId(key)

		test('getComment', function(){
			Equal(Comf.getComment(id, true), comment)
			Equal(Comf.getComment(key, true), comment)
		})

		test('getKeyComment', function(){
			Equal(Comf.getKeyComment(key, true), comment)
		})

		test('getSectionComment', function(){
			Equal(Comf.getSectionComment(id, true), comment)
		})

		test('get stripped comment', function(){
			Comf.setComment('key2', 'comment line1\ncomment line2')
			Equal(Comf.getComment('key2', true), '@ comment line1\n@ comment line2\n')
			const stripped = Comf.getComment('key2')
			Equal(stripped[0], 'comment line1')
			Equal(stripped[1], 'comment line2')
		})
	})

	test('delete', function(){
		Comf.deleteComment('key8')
		Equal(Comf.getComment('key8', true), '')
	})

	test('convert symbol', function(){
		Comf.convertCommentSymbol('@', '#')
		Equal(Comf.getComment('key3', true)[0], '#')
	})
})


section('section management', function(){

	test('moveSection error', function(){
		ErrObj(Comf.moveSection(404, 3))
	})

	test('moveSection', function(){
		// forward
		Comf.moveSection(4, 7)
		Equal(Comf.getSectionComment(6, true), '# just comment, no data\n')

		// backward
		Comf.moveSection(14, 7)
		Equal(Comf.getSectionComment(7, true), '# i will stay\n')
	})

	test('reorderSection', function(){

		const id = Comf.getSectionId('key5')
		Comf.reorderSection(id, ['key555', 'key5', 'key55'])

		const keys = Object.keys(Comf.tree[id].data)
		Equal(keys[0], 'key555')
		Equal(keys[1], 'key5')
		Equal(keys[2], 'key55')
	})

	test('deleteSection', function(){
		const id = Comf.getSectionId('key4')
		const len = Comf.tree.length
		Comf.deleteSection(id)
		Equal(Comf.tree.length, len-1)
		Equal(Comf.getSectionId('key4'), undefined)
		Equal(Comf.get('key7'), 3.14) // index rebuilt
	})

})


test('save', function(){
	Comf.saveSync(file)
})


section('new instance from saved file', function(){

	test('init', function(){
		conf = Comfig(file)
		Comf = conf.$()
	})

	test('read vars', function(){

		Equal(Comf.get('key0'), 'val0')
		Equal(Comf.get('key1'), 'val1')
		Equal(Comf.get('key2'), 'val2')
		Equal(Comf.get('key3'), 'val3')
		Equal(Comf.get('key5'), 'multi\n\nline')
		Equal(Comf.get('key55'), 'single line')
		Equal(Comf.get('key555'), 'x')
		Equal(Comf.get('key6'), 123)
		Equal(Comf.get('key7'), 3.14)

		Equal(Comf.get('key8'), true)
		Equal(Comf.get('key9'), false)
		Equal(Comf.get('key10'), null)

		Equal(Comf.get('key11.aaa'), 111)
		Equal(Comf.get('key11.bbb'), 'BBB')
		Equal(Comf.get('key11.ccc'), true)

		Equal(Comf.get('key12.0'), 222)
		Equal(Comf.get('key12.1'), 'CCC')
		Equal(Comf.get('key12.2'), false)
	})

	test('read comments', function(){

		Equal(Comf.getComment('key3', true), '# key3\n')
		Equal(Comf.getComment('key5', true), '% rawr\n')
		Equal(Comf.getSectionComment(6, true), '# i will stay\n')
	})

	test('read obj vars', function(){

		conf = Comf.$()

		Equal(conf.key0, 'val0')
		Equal(conf.key1, 'val1')
		Equal(conf.key2, 'val2')
		Equal(conf.key3, 'val3')
		Equal(conf.key5, 'multi\n\nline')
		Equal(conf.key55, 'single line')
		Equal(conf.key555, 'x')
		Equal(conf.key6, 123)
		Equal(conf.key7, 3.14)

		Equal(conf.key8, true)
		Equal(conf.key9, false)
		Equal(conf.key10, null)

		Equal(conf.key11.aaa, 111)
		Equal(conf.key11.bbb, 'BBB')
		Equal(conf.key11.ccc, true)

		Equal(conf.key12[0], 222)
		Equal(conf.key12[1], 'CCC')
		Equal(conf.key12[2], false)
	})

	test('morph and read', function(){
		conf.key0 = 'v000'
		conf.key1 = 'v111'
		conf.key11.aaa = 'AAA'

		const inst = conf.$()

		Equal(inst.get('key0'), 'v000')
		Equal(inst.get('key1'), 'v111')
		Equal(inst.get('key11.aaa'), 'AAA')
	})
})

section('sync', function(){

	test('require mode option', function(){
		ErrObj(Comf.sync({}))
	})

	test('update', function(){
		conf = Comfig(null)
		Comf = conf.$()
		Comf.set('key1', 'val1', {create:true})
		Comf.set('key2', 321, {create:true})

		Comf.sync({
			key2: 222,
			key4: 444
		}, {update:true})

		Equal(Comf.get('key1'), 'val1')
		Equal(Comf.get('key2'), 222)
		Equal(Comf.get('key4'), undefined)
	})

	test('merge', function(){
		conf = Comfig(null)
		Comf = conf.$()
		Comf.set('key1', 'val1', {create:true})
		Comf.set('key2', 321, {create:true})

		Comf.sync({
			key2: 222,
			key4: 444
		}, {merge:true})

		Equal(Comf.get('key1'), 'val1')
		Equal(Comf.get('key2'), 222)
		Equal(Comf.get('key4'), 444)
	})

	test('mirror', function(){
		conf = Comfig(null)
		Comf = conf.$()
		Comf.set('key1', 'val1', {create:true})
		Comf.set('key2', 321, {create:true})

		Comf.sync({
			key2: 222,
			key4: 444
		}, {mirror:true})

		Equal(Comf.get('key1'), undefined)
		Equal(Comf.get('key2'), 222)
		Equal(Comf.get('key4'), 444)
	})
})

//
// 	The End
//

console.log(`\n\x1b[7;92m ✔ All tests passed \x1b[0m`)
console.log(`Runtime: ${Date.now() - start}ms`)