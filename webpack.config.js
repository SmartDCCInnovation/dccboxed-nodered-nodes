/*
 * Created on Tue Aug 16 2022
 *
 * Copyright (c) 2022 Smart DCC Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const path = require('path')
const glob = require('glob')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin')

const entry = Object.assign(
  {},
  ...glob.sync('./src/**/*.editor.ts').map((f) => ({
    [f.match(/(?<=\/)[a-zA-Z0-9_-]+(?=\.editor\.ts)/)[0]]: f,
  })),
)

const outputs = Object.keys(entry).map(
  (f) =>
    new HtmlWebpackPlugin({
      filename: `${f}.html`,
      chunks: [f],
      template: entry[f].slice(0, -10) + '.html',
      inject: 'body',
    }),
)

module.exports = {
  mode: 'development',
  entry,
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    scriptType: 'text/javascript',
  },
  module: {
    rules: [
      { test: /\.ts?$/, loader: 'ts-loader' },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: outputs.concat([new HtmlInlineScriptPlugin()]),
  externals: {
    jquery: 'jQuery',
  },
}
