from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.release_warning_kind import ReleaseWarningKind
from typing import cast






T = TypeVar("T", bound="ReleaseWarning")



@_attrs_define
class ReleaseWarning:
    """ 
        Attributes:
            kind (ReleaseWarningKind):
            issue_key (str):
            blocker_key (None | str):
     """

    kind: ReleaseWarningKind
    issue_key: str
    blocker_key: None | str





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind.value

        issue_key = self.issue_key

        blocker_key: None | str
        blocker_key = self.blocker_key


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "issueKey": issue_key,
            "blockerKey": blocker_key,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = ReleaseWarningKind(d.pop("kind"))




        issue_key = d.pop("issueKey")

        def _parse_blocker_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        blocker_key = _parse_blocker_key(d.pop("blockerKey"))


        release_warning = cls(
            kind=kind,
            issue_key=issue_key,
            blocker_key=blocker_key,
        )

        return release_warning

