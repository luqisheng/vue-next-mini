export function patchDomProp(el: any, key: string, value: any) {
  try {
    el[key] = value
  } catch (error) {}
}
