from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.timeline_conflict_type_0 import TimelineConflictType0
  from ..models.timeline_conflict_type_1 import TimelineConflictType1
  from ..models.timeline_dependency import TimelineDependency
  from ..models.timeline_epic import TimelineEpic
  from ..models.timeline_milestone import TimelineMilestone





T = TypeVar("T", bound="Timeline")



@_attrs_define
class Timeline:
    """ 
        Attributes:
            epics (list[TimelineEpic]):
            milestones (list[TimelineMilestone]):
            dependencies (list[TimelineDependency]):
            conflicts (list[TimelineConflictType0 | TimelineConflictType1]):
            can_edit_versions (bool):
     """

    epics: list[TimelineEpic]
    milestones: list[TimelineMilestone]
    dependencies: list[TimelineDependency]
    conflicts: list[TimelineConflictType0 | TimelineConflictType1]
    can_edit_versions: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.timeline_conflict_type_0 import TimelineConflictType0 # noqa: PLC0415
        from ..models.timeline_conflict_type_1 import TimelineConflictType1 # noqa: PLC0415
        from ..models.timeline_dependency import TimelineDependency # noqa: PLC0415
        from ..models.timeline_epic import TimelineEpic # noqa: PLC0415
        from ..models.timeline_milestone import TimelineMilestone # noqa: PLC0415
        epics = []
        for epics_item_data in self.epics:
            epics_item = epics_item_data.to_dict()
            epics.append(epics_item)



        milestones = []
        for milestones_item_data in self.milestones:
            milestones_item = milestones_item_data.to_dict()
            milestones.append(milestones_item)



        dependencies = []
        for dependencies_item_data in self.dependencies:
            dependencies_item = dependencies_item_data.to_dict()
            dependencies.append(dependencies_item)



        conflicts = []
        for conflicts_item_data in self.conflicts:
            conflicts_item: dict[str, Any]
            if isinstance(conflicts_item_data, TimelineConflictType0):
                conflicts_item = conflicts_item_data.to_dict()
            else:
                conflicts_item = conflicts_item_data.to_dict()

            conflicts.append(conflicts_item)



        can_edit_versions = self.can_edit_versions


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "epics": epics,
            "milestones": milestones,
            "dependencies": dependencies,
            "conflicts": conflicts,
            "canEditVersions": can_edit_versions,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.timeline_conflict_type_0 import TimelineConflictType0 # noqa: PLC0415
        from ..models.timeline_conflict_type_1 import TimelineConflictType1 # noqa: PLC0415
        from ..models.timeline_dependency import TimelineDependency # noqa: PLC0415
        from ..models.timeline_epic import TimelineEpic # noqa: PLC0415
        from ..models.timeline_milestone import TimelineMilestone # noqa: PLC0415
        d = dict(src_dict)
        epics = []
        _epics = d.pop("epics")
        for epics_item_data in (_epics):
            epics_item = TimelineEpic.from_dict(epics_item_data)



            epics.append(epics_item)


        milestones = []
        _milestones = d.pop("milestones")
        for milestones_item_data in (_milestones):
            milestones_item = TimelineMilestone.from_dict(milestones_item_data)



            milestones.append(milestones_item)


        dependencies = []
        _dependencies = d.pop("dependencies")
        for dependencies_item_data in (_dependencies):
            dependencies_item = TimelineDependency.from_dict(dependencies_item_data)



            dependencies.append(dependencies_item)


        conflicts = []
        _conflicts = d.pop("conflicts")
        for conflicts_item_data in (_conflicts):
            def _parse_conflicts_item(data: object) -> TimelineConflictType0 | TimelineConflictType1:
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_timeline_conflict_type_0 = TimelineConflictType0.from_dict(data)



                    return componentsschemas_timeline_conflict_type_0
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_timeline_conflict_type_1 = TimelineConflictType1.from_dict(data)



                return componentsschemas_timeline_conflict_type_1

            conflicts_item = _parse_conflicts_item(conflicts_item_data)

            conflicts.append(conflicts_item)


        can_edit_versions = d.pop("canEditVersions")

        timeline = cls(
            epics=epics,
            milestones=milestones,
            dependencies=dependencies,
            conflicts=conflicts,
            can_edit_versions=can_edit_versions,
        )

        return timeline

