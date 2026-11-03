from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="ScopeProgressSprintsItem")



@_attrs_define
class ScopeProgressSprintsItem:
    """ 
        Attributes:
            name (str):
            completed_at (datetime.datetime):
            scope (float):
            added (float):
            done (float):
            remaining (float):
     """

    name: str
    completed_at: datetime.datetime
    scope: float
    added: float
    done: float
    remaining: float





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        completed_at = self.completed_at.isoformat()

        scope = self.scope

        added = self.added

        done = self.done

        remaining = self.remaining


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "name": name,
            "completedAt": completed_at,
            "scope": scope,
            "added": added,
            "done": done,
            "remaining": remaining,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        completed_at = datetime.datetime.fromisoformat(d.pop("completedAt"))




        scope = d.pop("scope")

        added = d.pop("added")

        done = d.pop("done")

        remaining = d.pop("remaining")

        scope_progress_sprints_item = cls(
            name=name,
            completed_at=completed_at,
            scope=scope,
            added=added,
            done=done,
            remaining=remaining,
        )

        return scope_progress_sprints_item

