from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.health_status_database import HealthStatusDatabase
from ..models.health_status_status import HealthStatusStatus
from ..types import UNSET, Unset






T = TypeVar("T", bound="HealthStatus")



@_attrs_define
class HealthStatus:
    """ 
        Attributes:
            status (HealthStatusStatus):
            database (HealthStatusDatabase | Unset):
     """

    status: HealthStatusStatus
    database: HealthStatusDatabase | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        database: str | Unset = UNSET
        if not isinstance(self.database, Unset):
            database = self.database.value



        field_dict: dict[str, Any] = {}

        field_dict.update({
            "status": status,
        })
        if database is not UNSET:
            field_dict["database"] = database

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = HealthStatusStatus(d.pop("status"))




        _database = d.pop("database", UNSET)
        database: HealthStatusDatabase | Unset
        if isinstance(_database,  Unset):
            database = UNSET
        else:
            database = HealthStatusDatabase(_database)




        health_status = cls(
            status=status,
            database=database,
        )

        return health_status

