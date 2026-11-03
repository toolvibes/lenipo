from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="DirectorySyncResult")



@_attrs_define
class DirectorySyncResult:
    """ 
        Attributes:
            created (int):
            updated (int):
            deactivated (int):
            groups (int):
            problems (list[str]):
     """

    created: int
    updated: int
    deactivated: int
    groups: int
    problems: list[str]





    def to_dict(self) -> dict[str, Any]:
        created = self.created

        updated = self.updated

        deactivated = self.deactivated

        groups = self.groups

        problems = self.problems




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "created": created,
            "updated": updated,
            "deactivated": deactivated,
            "groups": groups,
            "problems": problems,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        created = d.pop("created")

        updated = d.pop("updated")

        deactivated = d.pop("deactivated")

        groups = d.pop("groups")

        problems = cast(list[str], d.pop("problems"))


        directory_sync_result = cls(
            created=created,
            updated=updated,
            deactivated=deactivated,
            groups=groups,
            problems=problems,
        )

        return directory_sync_result

