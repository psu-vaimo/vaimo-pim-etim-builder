# Pre-loaded ETIM exports

ETIM exports placed here can be picked on the Import step instead of uploading files.

```
etim-files/
  ETIM-9.0/              release, the folder name is shown in the app
    en_US/               Akeneo locale code of the descriptions
      ETIMARTCLASS.csv   the ETIM CSV tables, as for an upload
      ETIMFEATURE.csv
      ...
    sv_SE/               more languages, added as translations
      ...
```

The dev server (`pnpm dev:web`) and `vite preview` list the folder on every request, new files show up after a page reload.
The exports are not committed (see `.gitignore`), only this README is.
