from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="PasswordChanged")



@_attrs_define
class PasswordChanged:
    """ 
        Attributes:
            ended_sessions (int):
     """

    ended_sessions: int





    def to_dict(self) -> dict[str, Any]:
        ended_sessions = self.ended_sessions


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "endedSessions": ended_sessions,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ended_sessions = d.pop("endedSessions")

        password_changed = cls(
            ended_sessions=ended_sessions,
        )

        return password_changed

