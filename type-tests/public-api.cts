import forms = require('@lpm.dev/neo.react-forms')
import validators = require('@lpm.dev/neo.react-forms/validators')
import stringValidators = require('@lpm.dev/neo.react-forms/validators/string')
import numberValidators = require('@lpm.dev/neo.react-forms/validators/number')
import composeValidators = require('@lpm.dev/neo.react-forms/validators/compose')
import adapters = require('@lpm.dev/neo.react-forms/adapters')
import developerTools = require('@lpm.dev/neo.react-forms/devtools')

const store = new forms.FormStore({ email: '', count: 0 })
store.setValue('email', 'user@example.com')

const email: string = store.getValue('email')
void email
void validators.required
void stringValidators.email
void numberValidators.min
void composeValidators.compose
void adapters.zodAdapter
void developerTools.createFormSnapshot
