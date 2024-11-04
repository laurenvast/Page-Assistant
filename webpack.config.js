const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = {
    entry: {
        background: './src/background.js',
        sidepanel: './src/sidepanel.js'
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        clean: true
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    plugins: [
        new Dotenv(),
        new CopyPlugin({
            patterns: [
                {
                    from: "src/manifest.json",
                    to: "manifest.json",
                    transform(content) {
                        return Buffer.from(JSON.stringify({
                            ...JSON.parse(content.toString()),
                            version: process.env.npm_package_version
                        }))
                    }
                },
                { from: "src/styles.css", to: "styles.css" },
                { from: "src/sidepanel.html", to: "sidepanel.html" }
            ]
        })
    ]
};