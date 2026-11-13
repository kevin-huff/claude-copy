import { expect, test } from 'claude-code/testing'

import { unwrapGrid } from '../hooks/grid'

const GRID = [
  '┌─────────┬───────────────────────────────┐',
  '│  Plan   │             Notes             │',
  '├─────────┼───────────────────────────────┤',
  '│ Basic   │ Includes one shared workspace │',
  '│ starter │ and email support on weekdays │',
  '├─────────┼───────────────────────────────┤',
  '│ Plus    │ Adds unlimited workspaces and │',
  '│         │ phone support                 │',
  '└─────────┴───────────────────────────────┘',
].join('\n')

const FLAT = 'Plan | Notes\nBasic starter | Includes one shared workspace and email support on weekdays\nPlus | Adds unlimited workspaces and phone support'

test('a wrapped box grid unwraps to one line per row', () => {
  expect(unwrapGrid(GRID)).toBe(FLAT)
})

test('text before and after a grid is kept in place', () => {
  const text = `Here is the comparison.\n\n${GRID}\n\nThe Plus plan costs more.`
  expect(unwrapGrid(text)).toBe(`Here is the comparison.\n\n${FLAT}\n\nThe Plus plan costs more.`)
})

test('a run with no top border still unwraps', () => {
  const lines = GRID.split('\n').slice(2)
  expect(unwrapGrid(lines.join('\n'))).toBe('Basic starter | Includes one shared workspace and email support on weekdays\nPlus | Adds unlimited workspaces and phone support')
})

test('a run with no borders at all unwraps when row lines share a bar count', () => {
  expect(unwrapGrid('│ Plan │ Notes │\n│ Plus │ Phone │')).toBe('Plan Plus | Notes Phone')
})

test('a single row line with no border is left alone', () => {
  expect(unwrapGrid('│ Plan │ Notes │')).toBe('│ Plan │ Notes │')
})

test('a block quote with one leading bar per line is unchanged', () => {
  const quote = '│ Remember to water the garden\n│ before noon on hot days'
  expect(unwrapGrid(quote)).toBe(quote)
})

test('a lone rule line is unchanged', () => {
  const text = 'Above\n──────────\nBelow'
  expect(unwrapGrid(text)).toBe(text)
})

test('plain text and a fenced code block are unchanged', () => {
  const plain = 'The garden needs watering.\n\nPack a warm jacket.'
  const fenced = '```\nconst a = 1\nconst b = a | 2\n```'
  expect(unwrapGrid(plain)).toBe(plain)
  expect(unwrapGrid(fenced)).toBe(fenced)
  expect(unwrapGrid('')).toBe('')
})
