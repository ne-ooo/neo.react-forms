const { FormStore } = require('@lpm.dev/neo.react-forms')
const { required } = require('@lpm.dev/neo.react-forms/validators')
const { email } = require('@lpm.dev/neo.react-forms/validators/string')
const { min } = require('@lpm.dev/neo.react-forms/validators/number')
const { compose } = require('@lpm.dev/neo.react-forms/validators/compose')

const store = new FormStore({ email: '' })
store.setValue('email', 'user@example.com')

if (store.getValue('email') !== 'user@example.com') {
  throw new Error('CommonJS package entry did not preserve the field value')
}

void (async () => {
  if (
    await compose([required(), email()])('user@example.com') !== null ||
    min(1)(0) === undefined
  ) {
    throw new Error('CommonJS validator entry points did not execute correctly')
  }
})()
