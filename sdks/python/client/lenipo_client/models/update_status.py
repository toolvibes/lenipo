from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="UpdateStatus")



@_attrs_define
class UpdateStatus:
    """ 
        Attributes:
            current (str):
            enabled (bool):
            latest (None | str):
            url (None | str):
            checked_at (datetime.datetime | None):
            available (bool):
            error (None | str):
     """

    current: str
    enabled: bool
    latest: None | str
    url: None | str
    checked_at: datetime.datetime | None
    available: bool
    error: None | str





    def to_dict(self) -> dict[str, Any]:
        current = self.current

        enabled = self.enabled

        latest: None | str
        latest = self.latest

        url: None | str
        url = self.url

        checked_at: None | str
        if isinstance(self.checked_at, datetime.datetime):
            checked_at = self.checked_at.isoformat()
        else:
            checked_at = self.checked_at

        available = self.available

        error: None | str
        error = self.error


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "current": current,
            "enabled": enabled,
            "latest": latest,
            "url": url,
            "checkedAt": checked_at,
            "available": available,
            "error": error,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        current = d.pop("current")

        enabled = d.pop("enabled")

        def _parse_latest(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        latest = _parse_latest(d.pop("latest"))


        def _parse_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        url = _parse_url(d.pop("url"))


        def _parse_checked_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                checked_at_type_0 = datetime.datetime.fromisoformat(data)



                return checked_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        checked_at = _parse_checked_at(d.pop("checkedAt"))


        available = d.pop("available")

        def _parse_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        error = _parse_error(d.pop("error"))


        update_status = cls(
            current=current,
            enabled=enabled,
            latest=latest,
            url=url,
            checked_at=checked_at,
            available=available,
            error=error,
        )

        return update_status

