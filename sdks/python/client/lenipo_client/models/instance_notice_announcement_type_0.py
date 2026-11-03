from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.instance_notice_announcement_type_0_level import InstanceNoticeAnnouncementType0Level
from typing import cast
import datetime






T = TypeVar("T", bound="InstanceNoticeAnnouncementType0")



@_attrs_define
class InstanceNoticeAnnouncementType0:
    """ 
        Attributes:
            text (str):  Default: ''.
            level (InstanceNoticeAnnouncementType0Level):  Default: InstanceNoticeAnnouncementType0Level.INFO.
            starts_at (datetime.datetime | None):
            ends_at (datetime.datetime | None):
            version (str):
     """

    starts_at: datetime.datetime | None
    ends_at: datetime.datetime | None
    version: str
    text: str = ''
    level: InstanceNoticeAnnouncementType0Level = InstanceNoticeAnnouncementType0Level.INFO





    def to_dict(self) -> dict[str, Any]:
        text = self.text

        level = self.level.value

        starts_at: None | str
        if isinstance(self.starts_at, datetime.datetime):
            starts_at = self.starts_at.isoformat()
        else:
            starts_at = self.starts_at

        ends_at: None | str
        if isinstance(self.ends_at, datetime.datetime):
            ends_at = self.ends_at.isoformat()
        else:
            ends_at = self.ends_at

        version = self.version


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "text": text,
            "level": level,
            "startsAt": starts_at,
            "endsAt": ends_at,
            "version": version,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        text = d.pop("text")

        level = InstanceNoticeAnnouncementType0Level(d.pop("level"))




        def _parse_starts_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                starts_at_type_0 = datetime.datetime.fromisoformat(data)



                return starts_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        starts_at = _parse_starts_at(d.pop("startsAt"))


        def _parse_ends_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                ends_at_type_0 = datetime.datetime.fromisoformat(data)



                return ends_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        ends_at = _parse_ends_at(d.pop("endsAt"))


        version = d.pop("version")

        instance_notice_announcement_type_0 = cls(
            text=text,
            level=level,
            starts_at=starts_at,
            ends_at=ends_at,
            version=version,
        )

        return instance_notice_announcement_type_0

