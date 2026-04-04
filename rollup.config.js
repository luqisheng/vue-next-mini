import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
/**
 * rollup 配置文件
 * @description: rollup 配置文件
 */
export default [
    {
        // 入口文件
        input: 'packages/vue/src/index.ts',
        // 输出文件
        output: {
            // 生成 sourcemap
            sourcemap: true,
            // 输出文件名
            file: 'packages/vue/dist/vue.js',
            // 输出文件格式
            format: 'iife',
            // 变量名
            name: 'Vue'
        },
        plugins: [
            // 插件
            resolve(),
            // 插件
            commonjs(),
            // 插件
            typescript({
                tsconfig: './tsconfig.json',
                sourceMap: true,
                declaration: false
            })
        ]
    }
]