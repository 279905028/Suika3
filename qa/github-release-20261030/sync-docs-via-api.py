#!/usr/bin/env python3
"""发布完成后，仅同步当前收尾文档提交；复用已核验的Git对象同步过程。"""
import importlib.util,pathlib,subprocess
here=pathlib.Path(__file__).resolve().parent
root=here.parents[1]
spec=importlib.util.spec_from_file_location('release_sync',here/'sync-via-api.py')
sync=importlib.util.module_from_spec(spec);spec.loader.exec_module(sync)
sync.BASE=subprocess.check_output(['git','rev-parse','v1.1.0-beta.1^{}'],cwd=root).decode().strip()
sync.TARGET=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip()
assert sync.BASE!=sync.TARGET
changed=subprocess.check_output(['git','diff','--name-only','-z',sync.BASE,sync.TARGET],cwd=root).decode().rstrip('\0').split('\0')
assert all(p in {'README.md','TODO-v1.1.md','dist/README.md','docs/Git文件管理.md'} or p.startswith('qa/github-release-20261030/') for p in changed),changed
sync.OUT=here/'documentation-push';sync.OUT.mkdir(exist_ok=True)
sync.main()
