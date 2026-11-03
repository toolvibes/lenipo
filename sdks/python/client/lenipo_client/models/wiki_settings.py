from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="WikiSettings")



@_attrs_define
class WikiSettings:
    """ 
        Attributes:
            outdated_after_days (int | None):
     """

    outdated_after_days: int | None





    def to_dict(self) -> dict[str, Any]:
        outdated_after_days: int | None
        outdated_after_days = self.outdated_after_days


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "outdatedAfterDays": outdated_after_days,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_outdated_after_days(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        outdated_after_days = _parse_outdated_after_days(d.pop("outdatedAfterDays"))


        wiki_settings = cls(
            outdated_after_days=outdated_after_days,
        )

        return wiki_settings

