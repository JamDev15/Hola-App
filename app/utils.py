import re


def _snake_to_camel(name: str) -> str:
    parts = name.split('_')
    return parts[0] + ''.join(p.title() for p in parts[1:])


def _camel_to_snake(name: str) -> str:
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()


def to_camel(d: dict) -> dict:
    if d is None:
        return None
    return {_snake_to_camel(k): v for k, v in d.items()}


def to_snake(d: dict) -> dict:
    return {_camel_to_snake(k): v for k, v in d.items()}
