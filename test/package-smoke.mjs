import { FormStore } from '@lpm.dev/neo.react-forms'
import { required } from '@lpm.dev/neo.react-forms/validators'
import { email } from '@lpm.dev/neo.react-forms/validators/string'
import { min } from '@lpm.dev/neo.react-forms/validators/number'
import { compose } from '@lpm.dev/neo.react-forms/validators/compose'

const store = new FormStore({ email: '' })
store.setValue('email', 'user@example.com')

if (store.getValue('email') !== 'user@example.com') {
  throw new Error('ESM package entry did not preserve the field value')
}

if (
  await compose([required(), email()])('user@example.com') !== null ||
  min(1)(0) === undefined
) {
  throw new Error('ESM validator entry points did not execute correctly')
}
