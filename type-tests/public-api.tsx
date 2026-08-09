import {
  FormStore,
  useForm,
  type ArrayPath,
  type DeepReadonly,
  type FormStateSelector,
  type Path,
  type UseFieldReturn,
  type UseFormOptions,
  type ValueAtPath,
  type Validator,
} from '@lpm.dev/neo.react-forms'
import { required, url, type UrlValidatorOptions } from '@lpm.dev/neo.react-forms/validators'
import { minLength } from '@lpm.dev/neo.react-forms/validators/string'
import { min } from '@lpm.dev/neo.react-forms/validators/number'
import { compose } from '@lpm.dev/neo.react-forms/validators/compose'
import { zodAdapter } from '@lpm.dev/neo.react-forms/adapters'
import {
  createFormSnapshot,
  exposeFormToWindow,
  type DevToolsPrivacyOptions,
  type ExposeFormOptions,
} from '@lpm.dev/neo.react-forms/devtools'

interface ConsumerValues {
  profile?: {
    name: string
    birthday: Date
  }
  users: Array<{ name: string; active: boolean }>
  readonlyTags: readonly string[]
  age: number | undefined
}

type ConsumerPath = Path<ConsumerValues>
const validOptionalPath: ConsumerPath = 'profile.name'
const validArrayPath: ConsumerPath = 'users.0.active'
const validReadonlyArrayPath: ConsumerPath = 'readonlyTags.0'
void validOptionalPath
void validArrayPath
void validReadonlyArrayPath

// Built-in leaf values must not expose their prototype methods as form paths.
// @ts-expect-error Date methods are not field paths.
const invalidDatePath: ConsumerPath = 'profile.birthday.getTime'
void invalidDatePath

type ConsumerArrayPath = ArrayPath<ConsumerValues>
const usersPath: ConsumerArrayPath = 'users'
const tagsPath: ConsumerArrayPath = 'readonlyTags'
void usersPath
void tagsPath

// @ts-expect-error Scalar fields cannot be used with FieldArray.
const invalidArrayPath: ConsumerArrayPath = 'age'
void invalidArrayPath

type NestedName = ValueAtPath<ConsumerValues, 'users.0.name'>
const nestedName: NestedName = 'Ada'
void nestedName

const options: UseFormOptions<ConsumerValues> = {
  initialValues: {
    users: [{ name: 'Ada', active: true }],
    readonlyTags: ['math'],
    age: undefined,
  },
  validate: {
    profile: {
      name: (value, values) => {
        const firstUserName: string | undefined = values?.users[0]?.name
        void firstUserName
        return value ? undefined : 'Required'
      },
      birthday: (_value, values) => values?.age === undefined ? undefined : 'Unexpected age',
    },
    users: {
      name: (value, values) => values?.readonlyTags.includes(value) ? undefined : 'Unknown',
      active: (_value, values) => values?.age === undefined ? undefined : 'Unexpected age',
    },
    age: (value) => value === undefined ? undefined : min(0)(value),
  },
}

const contextAwareValidator: Validator<string, ConsumerValues> = (
  value,
  values,
  context
) => {
  const fieldName: string | undefined = context?.name
  const immutableValues: DeepReadonly<ConsumerValues> | undefined = context?.values
  const firstUserName: string | undefined = values?.users[0]?.name
  void fieldName
  void immutableValues
  void firstUserName
  if (context) {
    // @ts-expect-error Validator context values are read-only.
    context.values.age = 42
  }
  return value ? undefined : 'Required'
}
void contextAwareValidator

const selectFirstUser: FormStateSelector<ConsumerValues, string | undefined> =
  (state) => state.values.users[0]?.name
void selectFirstUser

// These imports guard every documented package subpath.
void required
void minLength
void compose
void zodAdapter
void createFormSnapshot

const urlOptions: UrlValidatorOptions = { protocols: ['https'] }
void url('Invalid URL', urlOptions)
const privacyOptions: DevToolsPrivacyOptions = {
  sensitiveFields: ['recoveryPhrase'],
}
const exposureOptions: ExposeFormOptions = { enabled: true }
void privacyOptions
void exposureOptions

export function PublicApiConsumer() {
  const form = useForm(options)
  const ageField: UseFieldReturn<number | undefined> = form.useField('age')
  const firstUser = form.useFormState(selectFirstUser)
  const selectedValidity = form.useFormState(
    (state) => ({ valid: state.isValid }),
    (previous, next) => previous.valid === next.valid
  )
  void firstUser
  void selectedValidity

  ageField.setValue(21)
  // @ts-expect-error Age fields do not accept strings.
  ageField.setValue('21')
  // @ts-expect-error Unknown fields cannot be subscribed.
  form.useField('missing')

  form.batch(() => {
    form.setFieldValue('users.0.name', 'Katherine')
    form.setFieldTouched('users.0.name', true)
  })

  const snapshot = createFormSnapshot(form, options.initialValues, privacyOptions)
  const cleanupExposure = exposeFormToWindow('consumer', snapshot, exposureOptions)
  cleanupExposure()

  form.setFieldValue('users.0.name', 'Grace')
  // @ts-expect-error Array item names are strings.
  form.setFieldValue('users.0.name', 42)

  const store = new FormStore(options.initialValues)
  const unsubscribe = store.subscribe('users.0.name', (state) => {
    const value: string = state.value
    void value
  })
  unsubscribe()

  return (
    <>
      <form.Field name="age" inputType="number">
        {({ props }) => <input type="number" {...props} />}
      </form.Field>
      <form.Field name="users.0.active" inputType="checkbox">
        {({ props }) => <input type="checkbox" {...props} />}
      </form.Field>
      <form.FieldArray name="users">
        {({ fields, helpers }) => (
          <ul>
            {fields.map((field) => <li key={field.key}>{field.value.name}</li>)}
            <button
              type="button"
              onClick={() => helpers.append({ name: 'Grace', active: true })}
            >
              Add
            </button>
          </ul>
        )}
      </form.FieldArray>
      <form.FieldArray name="readonlyTags">
        {({ fields }) => <span>{fields[0]?.value.toUpperCase()}</span>}
      </form.FieldArray>
      {/* @ts-expect-error FieldArray only accepts array-valued paths. */}
      <form.FieldArray name="age">{() => null}</form.FieldArray>
    </>
  )
}
